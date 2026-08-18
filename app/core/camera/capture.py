"""
AI Surveillance System - Capture Worker

Dedicated thread for pulling frames from a single RTSP stream.
Implements bounded exponential backoff and frame metadata tagging.
"""

import logging
import threading
import time
import uuid
from datetime import datetime, timezone
from typing import Optional, Tuple, Any

import cv2

from app.core.camera.state import CameraHealth, CameraState, FrameMetadata
from app.core.camera.hub import FrameHub

logger = logging.getLogger(__name__)


class CaptureWorker:
    """
    Manages a single RTSP connection in a background thread.
    Handles OpenCV blocking calls and reconnect logic.
    """

    def __init__(
        self,
        camera_id: uuid.UUID,
        stream_url: str,
        stream_profile: Optional[str] = None,
        max_reconnect_delay: int = 60,
    ):
        self.camera_id = camera_id
        self.stream_url = stream_url
        self.stream_profile = stream_profile
        
        self.max_reconnect_delay = max_reconnect_delay
        self.current_reconnect_delay = 1
        
        self.health = CameraHealth(
            camera_id=self.camera_id,
            connection_state=CameraState.OFFLINE
        )
        
        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None
        
        self._cap: Optional[cv2.VideoCapture] = None
        self._frame_count = 0
        self._last_frame: Optional[Any] = None
        self._last_metadata: Optional[FrameMetadata] = None
        
        self._lock = threading.Lock()

    def start(self):
        """Starts the capture thread."""
        if self._thread and self._thread.is_alive():
            return
        
        self._stop_event.clear()
        self._thread = threading.Thread(
            target=self._run,
            name=f"CaptureWorker-{self.camera_id}",
            daemon=True
        )
        self._thread.start()

    def stop(self):
        """Signals the thread to stop and cleans up resources."""
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=5.0)
            
        with self._lock:
            if self._cap:
                self._cap.release()
                self._cap = None
            self.health.connection_state = CameraState.OFFLINE

    def get_latest_frame(self) -> Tuple[Optional[Any], Optional[FrameMetadata]]:
        """Thread-safe way to get the latest frame and its metadata."""
        with self._lock:
            return self._last_frame, self._last_metadata

    def get_health(self) -> CameraHealth:
        """Returns current health metrics."""
        with self._lock:
            # Copy to avoid race conditions
            return self.health.model_copy()

    def _set_state(self, state: CameraState):
        with self._lock:
            self.health.connection_state = state

    def _run(self):
        """Main thread loop."""
        while not self._stop_event.is_set():
            if self.health.connection_state in (CameraState.OFFLINE, CameraState.RECONNECTING, CameraState.AUTH_FAILED):
                self._connect()
                
            if self.health.connection_state == CameraState.ONLINE:
                self._capture_loop()
                
            if self._stop_event.is_set():
                break

    def _connect(self):
        """Attempt to establish the OpenCV connection with backoff."""
        self._set_state(CameraState.CONNECTING)
        
        # Simulate auth failure check for mock streams if needed, 
        # normally cv2 just returns False on open() for auth failures too,
        # but we handle it generically here.
        if "auth_fail" in self.stream_url:
            self._set_state(CameraState.AUTH_FAILED)
            time.sleep(1) # Prevent tight loop
            return

        with self._lock:
            if self._cap:
                self._cap.release()
            self._cap = cv2.VideoCapture(self.stream_url)
            
        if self._cap and self._cap.isOpened():
            self._set_state(CameraState.ONLINE)
            with self._lock:
                self.health.reconnect_count = 0
            self.current_reconnect_delay = 1
            logger.info(f"Camera {self.camera_id} connected successfully.")
        else:
            self._set_state(CameraState.RECONNECTING)
            with self._lock:
                self.health.reconnect_count += 1
                
            logger.warning(
                f"Camera {self.camera_id} connection failed. Retrying in {self.current_reconnect_delay}s"
            )
            
            # Wait for backoff duration or until stopped
            if self._stop_event.wait(self.current_reconnect_delay):
                return
                
            # Exponential backoff
            self.current_reconnect_delay = min(
                self.current_reconnect_delay * 2, 
                self.max_reconnect_delay
            )

    def _capture_loop(self):
        """Continuously pulls frames while connected."""
        fps_start_time = time.time()
        fps_frame_count = 0
        
        while not self._stop_event.is_set() and self.health.connection_state == CameraState.ONLINE:
            with self._lock:
                cap = self._cap
                
            if not cap or not cap.isOpened():
                self._set_state(CameraState.OFFLINE)
                break
                
            ret, frame = cap.read()
            now = datetime.now(timezone.utc)
            
            if not ret:
                logger.warning(f"Camera {self.camera_id} failed to grab frame.")
                with self._lock:
                    self.health.frame_failures += 1
                    
                # If we fail too many times in a row, consider it disconnected
                if self.health.frame_failures > 5:
                    self._set_state(CameraState.OFFLINE)
                    break
                    
                # Small delay to prevent tight loop on degraded stream
                time.sleep(0.1)
                continue
                
            # Success
            self._frame_count += 1
            fps_frame_count += 1
            
            metadata = FrameMetadata(
                camera_id=self.camera_id,
                frame_id=self._frame_count,
                timestamp=now,
                stream_profile=self.stream_profile,
                trace_id=uuid.uuid4().hex
            )
            
            with self._lock:
                self._last_frame = frame
                self._last_metadata = metadata
                self.health.last_frame_timestamp = now
                self.health.frame_failures = 0
                
                # Update FPS every second
                elapsed = time.time() - fps_start_time
                if elapsed >= 1.0:
                    self.health.fps = fps_frame_count / elapsed
                    fps_start_time = time.time()
                    fps_frame_count = 0
            
            # Publish to FrameHub for all downstream consumers
            FrameHub().publish(self.camera_id, frame, metadata)
