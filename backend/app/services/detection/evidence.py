"""
AI Surveillance System - Evidence Capture & Rolling Buffer Manager

Manages bounded in-memory frame buffers per camera and saves evidence snapshots
annotated with bounding boxes and metadata when security events trigger.
"""

import collections
import logging
import os
import threading
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np

logger = logging.getLogger(__name__)

# Base directory for stored evidence snapshots
EVIDENCE_DIR = Path("evidence/snapshots")
EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)


class EvidenceCaptureManager:
    """
    Singleton rolling buffer and snapshot generator.
    Keeps a bounded ring-buffer of recent frames per camera to capture event snapshots.
    """

    _instance = None
    _lock = threading.Lock()

    def __new__(cls, max_buffer_frames: int = 150):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(EvidenceCaptureManager, cls).__new__(cls)
                cls._instance._init_state(max_buffer_frames)
            return cls._instance

    def _init_state(self, max_buffer_frames: int):
        self.max_buffer_frames = max_buffer_frames
        # camera_id -> deque of (frame_data, timestamp, frame_id)
        self._buffers: Dict[uuid.UUID, collections.deque] = collections.defaultdict(
            lambda: collections.deque(maxlen=self.max_buffer_frames)
        )
        self._buf_lock = threading.Lock()

    def push_frame(self, camera_id: uuid.UUID, frame_data: np.ndarray, frame_id: int):
        """Add a frame to the camera's rolling buffer."""
        if frame_data is None or not isinstance(frame_data, np.ndarray):
            return
        with self._buf_lock:
            self._buffers[camera_id].append((frame_data.copy(), time.time(), frame_id))

    def capture_snapshot(
        self,
        camera_id: uuid.UUID,
        label: str,
        confidence: float,
        bbox: Optional[List[float]] = None,
        track_id: Optional[int] = None,
    ) -> Optional[str]:
        """
        Extracts the latest frame from the buffer, overlays bounding box and metadata,
        writes it to the evidence directory, and returns the relative file path.
        """
        with self._buf_lock:
            buf = self._buffers.get(camera_id)
            if not buf:
                return None
            frame, ts, fid = buf[-1]

        if frame is None:
            return None

        annotated = frame.copy()
        h, w = annotated.shape[:2]

        # Draw bounding box if provided [x_min, y_min, x_max, y_max] normalized [0,1]
        if bbox and len(bbox) == 4:
            x1 = int(bbox[0] * w)
            y1 = int(bbox[1] * h)
            x2 = int(bbox[2] * w)
            y2 = int(bbox[3] * h)

            color = (0, 255, 0) if "person" in label.lower() else (255, 140, 0)
            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)

            text = f"{label.title()} {int(confidence * 100)}%"
            if track_id is not None:
                text = f"#{track_id} {text}"

            (tw, th), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
            cv2.rectangle(annotated, (x1, y1 - th - 8), (x1 + tw + 6, y1), color, -1)
            cv2.putText(annotated, text, (x1 + 3, y1 - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)

        # Draw timestamp and camera watermark
        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        watermark = f"CAM: {str(camera_id)[:8]}... | {now_str}"
        cv2.putText(annotated, watermark, (10, h - 12), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1, cv2.LINE_AA)

        # Write to disk
        filename = f"event_{str(camera_id)[:8]}_{int(time.time() * 1000)}_{label.replace(' ', '_')}.jpg"
        filepath = EVIDENCE_DIR / filename

        try:
            cv2.imwrite(str(filepath), annotated, [cv2.IMWRITE_JPEG_QUALITY, 85])
            rel_path = f"/evidence/snapshots/{filename}"
            logger.info(f"Evidence snapshot saved: {rel_path}")
            return rel_path
        except Exception as e:
            logger.error(f"Failed to write evidence snapshot: {e}")
            return None


evidence_manager = EvidenceCaptureManager()
