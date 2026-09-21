import logging
import time
import uuid
from typing import List, Optional, Set

import numpy as np

from app.core.ai.models import DetectionResult, FrameEnvelope, PluginManifest
from app.core.ai.plugin import AIPlugin
from app.core.config import settings
from app.core.ai.yolo11m_singleton import detect_frame, load_model

logger = logging.getLogger(__name__)

class YoloPlugin(AIPlugin):
    """
    YOLOv8-based object detection plugin.
    Now wraps the YOLO11m singleton for high-performance inference.
    """

    def __init__(
        self,
        camera_id: uuid.UUID,
        model_path: Optional[str] = None,
        confidence_threshold: Optional[float] = None,
        iou_threshold: Optional[float] = None,
        inference_size: Optional[int] = None,
        sample_every_n_frames: Optional[int] = None,
        device: Optional[str] = None,
        class_filter: Optional[Set[str]] = None,
    ):
        super().__init__(camera_id)
        self.model_path = model_path or settings.DETECTION_MODEL_PATH
        self.confidence_threshold = confidence_threshold if confidence_threshold is not None else settings.DETECTION_CONFIDENCE
        self.iou_threshold = iou_threshold if iou_threshold is not None else settings.DETECTION_IOU
        self.inference_size = inference_size if inference_size is not None else settings.DETECTION_IMAGE_SIZE
        self.sample_every_n_frames = sample_every_n_frames if sample_every_n_frames is not None else settings.DETECTION_FRAME_SKIP
        
        if class_filter is not None:
            self.class_filter = class_filter
        elif settings.DETECTION_CLASS_FILTER.strip():
            self.class_filter = {c.strip().lower() for c in settings.DETECTION_CLASS_FILTER.split(",") if c.strip()}
        else:
            self.class_filter = set()

        self._frames_processed = 0
        self._total_latency = 0.0
        self._last_inference_ms = 0.0

    def initialize(self) -> None:
        """Sets up the plugin manifest."""
        self.manifest = PluginManifest(
            id="yolo11m-object-detector",
            name="YOLO11m Object Detector",
            version="1.0.0",
            description=f"YOLO detection using YOLO11m singleton.",
            supported_architectures=["cpu", "gpu", "cuda"]
        )

    def load(self) -> None:
        """Ensure YOLO11m singleton is loaded."""
        load_model()

    def process(self, envelope: FrameEnvelope) -> List[DetectionResult]:
        """Runs YOLO11m inference on the provided frame using the singleton."""
        frame_data = envelope.frame_data

        if self.sample_every_n_frames > 1 and envelope.metadata.frame_id % self.sample_every_n_frames != 0:
            return []

        if not isinstance(frame_data, np.ndarray) or frame_data.size == 0:
            return []

        img_h, img_w = frame_data.shape[:2]
        if img_h < 10 or img_w < 10:
            return []

        result = detect_frame(
            frame=frame_data,
            confidence=self.confidence_threshold,
            iou=self.iou_threshold,
            imgsz=self.inference_size
        )
        
        processing_time_ms = result.get("inference_ms", 0)
        self._frames_processed += 1
        self._total_latency += processing_time_ms
        self._last_inference_ms = processing_time_ms

        detections = []
        for det in result.get("detections", []):
            label = det["class_name"]
            
            if self.class_filter and label.lower() not in self.class_filter:
                continue

            x1, y1, x2, y2 = det["bbox"]["x1"], det["bbox"]["y1"], det["bbox"]["x2"], det["bbox"]["y2"]

            nx1 = max(0.0, min(1.0, x1 / img_w))
            ny1 = max(0.0, min(1.0, y1 / img_h))
            nx2 = max(0.0, min(1.0, x2 / img_w))
            ny2 = max(0.0, min(1.0, y2 / img_h))

            detections.append(DetectionResult(
                camera_id=envelope.metadata.camera_id,
                frame_id=envelope.metadata.frame_id,
                observed_at=envelope.metadata.timestamp,
                confidence=det["confidence"],
                bounding_box=[nx1, ny1, nx2, ny2],
                model_id=self.manifest.id,
                model_version=self.manifest.version,
                processing_time_ms=processing_time_ms,
                label=label
            ))

        return detections

    def health(self) -> dict:
        status = super().health()
        avg_latency = 0.0
        if self._frames_processed > 0:
            avg_latency = self._total_latency / self._frames_processed

        status["avg_inference_latency_ms"] = round(avg_latency, 2)
        status["last_inference_ms"] = round(self._last_inference_ms, 2)
        status["frames_processed"] = self._frames_processed
        status["device"] = settings.DETECTION_DEVICE
        status["model_path"] = self.model_path
        status["class_filter"] = list(self.class_filter) if self.class_filter else "all"
        return status
