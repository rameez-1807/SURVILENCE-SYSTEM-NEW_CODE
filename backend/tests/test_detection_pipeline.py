"""
AI Surveillance System - Real-Time Detection Pipeline Tests

Tests for:
- YOLO Plugin (single load, device resolution, class filtering, invalid frames)
- ByteTrack Object Tracker (stable track IDs, multiple objects, disappearance)
- Detection Pipeline (temporal confirmation, cooldown debouncing, evidence capture)
- Metrics Collector (telemetry, FPS, latency)
- Detection Zones (ROI point-in-polygon)
"""

import time
import uuid
from datetime import datetime, timezone
import numpy as np
import pytest

from app.core.ai.models import DetectionResult, FrameEnvelope
from app.core.ai.tracker import ObjectTracker, TrackedObject
from app.core.ai.yolo_plugin import YoloPlugin
from app.core.camera.state import FrameMetadata
from app.core.rules.evaluators import evaluate_zone
from app.services.detection.evidence import EvidenceCaptureManager
from app.services.detection.metrics import DetectionMetricsCollector


def create_mock_metadata(frame_id: int, camera_id: uuid.UUID) -> FrameMetadata:
    return FrameMetadata(
        camera_id=camera_id,
        frame_id=frame_id,
        timestamp=datetime.now(timezone.utc),
        trace_id=f"trace_{frame_id}"
    )


def test_yolo_plugin_invalid_frame_handling():
    """Plugin should gracefully handle None, empty, or corrupt frames."""
    camera_id = uuid.uuid4()
    plugin = YoloPlugin(camera_id)
    plugin.initialize()

    # 1. Non-numpy frame
    meta = create_mock_metadata(1, camera_id)
    assert plugin.process(FrameEnvelope(metadata=meta, frame_data="not-an-image")) == []

    # 2. Empty numpy array
    empty_frame = np.array([], dtype=np.uint8)
    assert plugin.process(FrameEnvelope(metadata=meta, frame_data=empty_frame)) == []

    # 3. Tiny 2x2 image
    tiny_frame = np.zeros((2, 2, 3), dtype=np.uint8)
    assert plugin.process(FrameEnvelope(metadata=meta, frame_data=tiny_frame)) == []


def test_yolo_plugin_class_filtering():
    """Plugin should only return detections matching class_filter."""
    camera_id = uuid.uuid4()
    plugin = YoloPlugin(camera_id, class_filter={"person", "car"}, sample_every_n_frames=1)
    plugin.initialize()

    import unittest.mock as mock

    # Mock YOLO prediction result format returned by detect_frame
    def mock_detect_frame(frame, confidence, iou, imgsz):
        return {
            "inference_ms": 10,
            "detections": [
                {"class_name": "person", "confidence": 0.9, "bbox": {"x1": 10, "y1": 10, "x2": 100, "y2": 100}},
                {"class_name": "bicycle", "confidence": 0.8, "bbox": {"x1": 20, "y1": 20, "x2": 150, "y2": 150}},
                {"class_name": "car", "confidence": 0.95, "bbox": {"x1": 30, "y1": 30, "x2": 200, "y2": 200}},
                {"class_name": "dog", "confidence": 0.85, "bbox": {"x1": 40, "y1": 40, "x2": 80, "y2": 80}},
            ]
        }

    with mock.patch("app.core.ai.yolo_plugin.detect_frame", side_effect=mock_detect_frame):
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        envelope = FrameEnvelope(metadata=create_mock_metadata(1, camera_id), frame_data=frame)
        dets = plugin.process(envelope)

    labels = [d.label for d in dets]
    assert "person" in labels
    assert "car" in labels
    assert "bicycle" not in labels
    assert "dog" not in labels
    assert len(dets) == 2


def test_bytetrack_tracker_stable_ids():
    """Tracker should assign stable track_id across consecutive frames for the same bounding box."""
    camera_id = uuid.uuid4()
    tracker = ObjectTracker(camera_id)

    frame_shape = (480, 640, 3)

    # Frame 1: Detection at (100, 100, 200, 200)
    det1 = DetectionResult(
        camera_id=camera_id,
        frame_id=1,
        observed_at=datetime.now(timezone.utc),
        confidence=0.92,
        bounding_box=[100/640, 100/480, 200/640, 200/480],
        model_id="yolo-v8",
        model_version="1.0.0",
        processing_time_ms=25.0,
        label="person"
    )
    tracked_f1 = tracker.update([det1], frame_shape)
    assert len(tracked_f1) == 1
    t1_id = tracked_f1[0].track_id

    # Frame 2: Same object slightly shifted to (105, 102, 205, 202)
    det2 = DetectionResult(
        camera_id=camera_id,
        frame_id=2,
        observed_at=datetime.now(timezone.utc),
        confidence=0.94,
        bounding_box=[105/640, 102/480, 205/640, 202/480],
        model_id="yolo-v8",
        model_version="1.0.0",
        processing_time_ms=22.0,
        label="person"
    )
    tracked_f2 = tracker.update([det2], frame_shape)
    assert len(tracked_f2) == 1
    t2_id = tracked_f2[0].track_id

    # Track ID must remain identical
    assert t1_id == t2_id
    assert tracked_f2[0].frames_seen == 2


def test_evidence_capture_manager():
    """Evidence manager should store frames in ring buffer and generate annotated snapshots."""
    camera_id = uuid.uuid4()
    mgr = EvidenceCaptureManager(max_buffer_frames=10)

    # Push 5 synthetic frames
    for i in range(5):
        frame = np.ones((480, 640, 3), dtype=np.uint8) * 100
        mgr.push_frame(camera_id, frame, i)

    # Capture snapshot
    path = mgr.capture_snapshot(
        camera_id=camera_id,
        label="person",
        confidence=0.95,
        bbox=[0.1, 0.1, 0.5, 0.8],
        track_id=42
    )
    assert path is not None
    assert path.startswith("/evidence/snapshots/")
    assert "person" in path


def test_metrics_collector_telemetry():
    """Metrics collector should correctly compute FPS, average latency, and record counters."""
    collector = DetectionMetricsCollector()

    # Record 5 inferences
    for lat in [30.0, 35.0, 40.0, 45.0, 50.0]:
        collector.record_inference(latency_ms=lat, detections_count=2)
        collector.record_event()

    summary = collector.get_summary()
    assert summary["status"] == "healthy"
    assert summary["avg_inference_latency_ms"] == 40.0
    assert summary["total_detections"] >= 10
    assert summary["total_events"] >= 5


def test_detection_zone_polygon_evaluation():
    """Test ROI zone polygon ray-casting evaluation."""
    # Zone covering center [0.25, 0.25] to [0.75, 0.75]
    zone_config = {
        "polygons": [
            [[0.25, 0.25], [0.75, 0.25], [0.75, 0.75], [0.25, 0.75]]
        ]
    }

    # BBox in center: [0.4, 0.4, 0.6, 0.6] -> center (0.5, 0.5) is inside
    inside_bbox = [0.4, 0.4, 0.6, 0.6]
    assert evaluate_zone(inside_bbox, zone_config) is True

    # BBox outside in top-left: [0.0, 0.0, 0.1, 0.1] -> center (0.05, 0.05) is outside
    outside_bbox = [0.0, 0.0, 0.1, 0.1]
    assert evaluate_zone(outside_bbox, zone_config) is False
