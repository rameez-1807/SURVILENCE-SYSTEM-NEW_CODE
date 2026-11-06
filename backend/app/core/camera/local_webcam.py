"""
Local Hardware Webcam Manager via DirectShow (Windows) / V4L2 (Linux)
Provides seamless zero-permission streaming and frame capture for kiosk & local attendance.
"""

import cv2
import time
import base64
import threading
import logging
from typing import Optional
import numpy as np

logger = logging.getLogger(__name__)


class LocalWebcamManager:
    """Manages background frame capture from local USB or integrated webcam."""

    def __init__(self, device_index: int = 0):
        self.device_index = device_index
        self._cap: Optional[cv2.VideoCapture] = None
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._lock = threading.Lock()
        self._latest_frame: Optional[np.ndarray] = None
        self._last_read_time = 0.0

    def start(self):
        """Start hardware webcam background capture worker."""
        with self._lock:
            if self._running and self._cap and self._cap.isOpened():
                return
            try:
                # DirectShow is fastest & lowest latency on Windows
                self._cap = cv2.VideoCapture(self.device_index, cv2.CAP_DSHOW)
                if not self._cap.isOpened():
                    self._cap = cv2.VideoCapture(self.device_index)
                if not self._cap.isOpened():
                    logger.warning("Could not open local hardware webcam index %d", self.device_index)
                    return

                self._cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
                self._cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

                self._running = True
                self._thread = threading.Thread(target=self._capture_loop, daemon=True)
                self._thread.start()
                logger.info("Local hardware webcam worker started on index %d", self.device_index)
            except Exception as e:
                logger.error("Error starting local webcam worker: %s", e)

    def _capture_loop(self):
        """Continuous background capture loop to flush buffers and provide fresh frames."""
        while self._running and self._cap and self._cap.isOpened():
            ret, frame = self._cap.read()
            if ret and frame is not None:
                with self._lock:
                    self._latest_frame = frame
                    self._last_read_time = time.time()
            time.sleep(0.025)  # ~40 FPS capture rate

    def get_latest_frame(self) -> Optional[np.ndarray]:
        """Fetch latest captured frame as BGR numpy array."""
        if not self._running or self._cap is None or not self._cap.isOpened():
            self.start()

        # Wait briefly for first frame if just started
        for _ in range(10):
            with self._lock:
                if self._latest_frame is not None:
                    return self._latest_frame.copy()
            time.sleep(0.05)

        # Direct grab fallback
        if self._cap and self._cap.isOpened():
            ret, frame = self._cap.read()
            if ret and frame is not None:
                return frame
        return None

    def get_latest_frame_base64(self) -> Optional[str]:
        """Fetch latest captured frame as base64 data URI."""
        frame = self.get_latest_frame()
        if frame is None:
            return None
        ret, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
        if ret:
            return "data:image/jpeg;base64," + base64.b64encode(buf).decode("utf-8")
        return None

    def stop(self):
        """Stop capture worker and release camera hardware."""
        with self._lock:
            self._running = False
            if self._cap:
                try:
                    self._cap.release()
                except Exception:
                    pass
                self._cap = None


local_webcam_manager = LocalWebcamManager()
