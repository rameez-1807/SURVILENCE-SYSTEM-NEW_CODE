"""
AI Surveillance System - Object Tracker (ByteTrack via Supervision)

Provides stable track_id assignment across consecutive frames.
Each camera gets its own tracker instance to maintain independent tracking state.
"""

import logging
import uuid
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional

import numpy as np

from app.core.ai.models import DetectionResult

logger = logging.getLogger(__name__)


@dataclass
class TrackedObject:
    """A single tracked object with stable identity across frames."""
    track_id: int
    class_name: str
    confidence: float
    bbox: List[float]  # [x_min, y_min, x_max, y_max] normalized [0,1]
    camera_id: uuid.UUID
    timestamp: float
    frames_seen: int = 1
    first_seen: float = 0.0
    last_seen: float = 0.0

    def duration_seconds(self) -> float:
        """How long this object has been tracked."""
        return self.last_seen - self.first_seen


class ObjectTracker:
    """
    Per-camera ByteTrack tracker using the supervision library.
    Maps YOLO DetectionResults → TrackedObjects with stable track_ids.
    """

    def __init__(self, camera_id: uuid.UUID):
        self.camera_id = camera_id
        self._tracker = None
        self._track_history: Dict[int, TrackedObject] = {}  # track_id → TrackedObject
        self._initialized = False

    def _ensure_initialized(self):
        """Lazy-initialize ByteTrack tracker."""
        if self._initialized:
            return
        try:
            import supervision as sv
            self._tracker = sv.ByteTrack(
                track_activation_threshold=0.25,
                lost_track_buffer=30,
                minimum_matching_threshold=0.8,
                frame_rate=30,
            )
            self._initialized = True
            logger.info(f"ByteTrack tracker initialized for camera {self.camera_id}")
        except ImportError:
            logger.error("supervision package required for tracking. Install: pip install supervision")
            raise

    def update(self, detections: List[DetectionResult], frame_shape: tuple) -> List[TrackedObject]:
        """
        Feed new detections into the tracker and return tracked objects.

        Args:
            detections: List of DetectionResult from YOLO
            frame_shape: (height, width) of the frame for denormalization

        Returns:
            List of TrackedObject with stable track_ids
        """
        self._ensure_initialized()
        import supervision as sv

        if not detections:
            # Update tracker with empty detections to maintain track aging
            empty_dets = sv.Detections.empty()
            self._tracker.update_with_detections(empty_dets)
            return []

        img_h, img_w = frame_shape[:2]
        now = time.time()

        # Convert normalized DetectionResults to pixel-space xyxy array
        xyxy_list = []
        confidence_list = []
        class_id_list = []
        label_map = {}  # class_id → label string

        # Build unique class_id mapping from labels
        label_to_id: Dict[str, int] = {}
        for det in detections:
            if det.label not in label_to_id:
                label_to_id[det.label] = len(label_to_id)
            label_map[label_to_id[det.label]] = det.label

            # Denormalize bbox from [0,1] to pixel coords
            x1 = det.bounding_box[0] * img_w
            y1 = det.bounding_box[1] * img_h
            x2 = det.bounding_box[2] * img_w
            y2 = det.bounding_box[3] * img_h

            xyxy_list.append([x1, y1, x2, y2])
            confidence_list.append(det.confidence)
            class_id_list.append(label_to_id[det.label])

        # Create supervision Detections object
        sv_detections = sv.Detections(
            xyxy=np.array(xyxy_list, dtype=np.float32),
            confidence=np.array(confidence_list, dtype=np.float32),
            class_id=np.array(class_id_list, dtype=int),
        )

        # Run ByteTrack update
        tracked = self._tracker.update_with_detections(sv_detections)

        # Build tracked objects
        result: List[TrackedObject] = []
        active_track_ids = set()

        if tracked.tracker_id is not None:
            for i, track_id in enumerate(tracked.tracker_id):
                track_id = int(track_id)
                active_track_ids.add(track_id)

                cls_id = int(tracked.class_id[i]) if tracked.class_id is not None else 0
                class_name = label_map.get(cls_id, "unknown")
                conf = float(tracked.confidence[i]) if tracked.confidence is not None else 0.0

                # Normalize bbox back to [0,1]
                x1, y1, x2, y2 = tracked.xyxy[i]
                bbox = [
                    float(x1 / img_w),
                    float(y1 / img_h),
                    float(x2 / img_w),
                    float(y2 / img_h),
                ]

                # Update or create track history
                if track_id in self._track_history:
                    existing = self._track_history[track_id]
                    existing.class_name = class_name
                    existing.confidence = conf
                    existing.bbox = bbox
                    existing.timestamp = now
                    existing.last_seen = now
                    existing.frames_seen += 1
                    result.append(existing)
                else:
                    obj = TrackedObject(
                        track_id=track_id,
                        class_name=class_name,
                        confidence=conf,
                        bbox=bbox,
                        camera_id=self.camera_id,
                        timestamp=now,
                        frames_seen=1,
                        first_seen=now,
                        last_seen=now,
                    )
                    self._track_history[track_id] = obj
                    result.append(obj)

        # Prune stale tracks (not seen for 60+ seconds)
        stale_ids = [
            tid for tid, tobj in self._track_history.items()
            if tid not in active_track_ids and (now - tobj.last_seen) > 60.0
        ]
        for tid in stale_ids:
            del self._track_history[tid]

        return result

    def get_active_tracks(self) -> List[TrackedObject]:
        """Return all currently active tracked objects."""
        now = time.time()
        return [
            t for t in self._track_history.values()
            if (now - t.last_seen) < 5.0  # seen within last 5 seconds
        ]

    def get_track_count(self) -> int:
        """Return number of active tracks."""
        return len(self.get_active_tracks())

    def reset(self):
        """Reset tracker state."""
        self._track_history.clear()
        self._initialized = False
        self._tracker = None
