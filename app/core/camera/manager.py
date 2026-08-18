"""
AI Surveillance System - Centralized Camera Manager

Ensures a single capture owner per camera/profile.
AI plugins and frontend must NOT create their own RTSP connection.
Only Camera Manager owns capture.
"""

import logging
import threading
import uuid
from typing import Dict, Optional, Tuple, Any

from app.core.camera.capture import CaptureWorker
from app.core.camera.state import CameraHealth, CameraState, FrameMetadata

logger = logging.getLogger(__name__)


class CameraManager:
    """
    Singleton manager for all camera captures.
    Prevents duplicate connections and orchestrates background threads.
    """
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(CameraManager, cls).__new__(cls)
                cls._instance._init_state()
            return cls._instance

    def _init_state(self):
        # Maps camera_id -> CaptureWorker
        self._workers: Dict[uuid.UUID, CaptureWorker] = {}
        self._workers_lock = threading.Lock()

    def start_stream(self, camera_id: uuid.UUID, stream_url: str, stream_profile: Optional[str] = None) -> None:
        """
        Requests to start a stream. If it's already running, does nothing (duplicate prevention).
        """
        with self._workers_lock:
            if camera_id in self._workers:
                logger.info(f"Stream for camera {camera_id} is already managed.")
                return
            
            logger.info(f"Starting new capture worker for camera {camera_id}")
            worker = CaptureWorker(
                camera_id=camera_id,
                stream_url=stream_url,
                stream_profile=stream_profile
            )
            self._workers[camera_id] = worker
            worker.start()

    def stop_stream(self, camera_id: uuid.UUID) -> None:
        """Stops the stream and cleans up resources for a specific camera."""
        with self._workers_lock:
            worker = self._workers.pop(camera_id, None)
            
        if worker:
            logger.info(f"Stopping capture worker for camera {camera_id}")
            worker.stop()

    def get_health(self, camera_id: uuid.UUID) -> Optional[CameraHealth]:
        """Gets the health metrics of a specific camera stream."""
        with self._workers_lock:
            worker = self._workers.get(camera_id)
            
        if worker:
            return worker.get_health()
        return None

    def get_latest_frame(self, camera_id: uuid.UUID) -> Tuple[Optional[Any], Optional[FrameMetadata]]:
        """Gets the latest frame and metadata for a specific camera."""
        with self._workers_lock:
            worker = self._workers.get(camera_id)
            
        if worker:
            return worker.get_latest_frame()
        return None, None

    def shutdown_all(self) -> None:
        """Stops all active streams. Called on application shutdown."""
        logger.info("Shutting down all camera streams...")
        with self._workers_lock:
            workers = list(self._workers.values())
            self._workers.clear()
            
        for worker in workers:
            worker.stop()
        logger.info("All camera streams shut down.")
