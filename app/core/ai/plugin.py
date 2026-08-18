import abc
import logging
import threading
import time
import uuid
from typing import List, Optional

from app.core.ai.models import DetectionResult, FrameEnvelope, PluginManifest
from app.core.camera.hub import ConsumerStrategy, FrameHub

logger = logging.getLogger(__name__)


class AIPlugin(abc.ABC):
    """
    Abstract Base Class for all AI Plugins.
    Enforces isolation: plugins only consume from FrameHub and cannot access cameras directly.
    """
    def __init__(self, camera_id: uuid.UUID):
        self.camera_id = camera_id
        self.manifest: Optional[PluginManifest] = None
        
        self._hub = FrameHub()
        self._queue = None
        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None

    @abc.abstractmethod
    def initialize(self) -> None:
        """Set up basic configuration and manifest."""
        pass

    @abc.abstractmethod
    def load(self) -> None:
        """Load weights and models into memory (GPU/CPU)."""
        pass

    @abc.abstractmethod
    def process(self, envelope: FrameEnvelope) -> List[DetectionResult]:
        """Core execution step. Processes a single frame and returns results."""
        pass

    def health(self) -> dict:
        """Report plugin health status."""
        status = {
            "is_running": self._thread is not None and self._thread.is_alive(),
            "manifest": self.manifest.model_dump() if self.manifest else None,
        }
        if self.manifest and self._queue:
            hub_health = self._hub.get_health(self.camera_id, self.manifest.id)
            if hub_health:
                status["queue_depth"] = hub_health.queue_depth
                status["dropped_frames"] = hub_health.dropped_frames
                status["processed_frames"] = hub_health.processed_frames
        return status

    def start(self) -> None:
        """Subscribes to the hub and starts the processing thread."""
        if not self.manifest:
            raise ValueError("Plugin must be initialized before starting.")
            
        self._queue = self._hub.subscribe(
            self.camera_id,
            consumer_name=self.manifest.id,
            strategy=ConsumerStrategy.LATEST,
            max_size=5  # Small bounded queue to ensure latest frame strategy works effectively
        )
        
        self._stop_event.clear()
        self._thread = threading.Thread(
            target=self._run_loop,
            name=f"AIPlugin-{self.manifest.id}-{self.camera_id}",
            daemon=True
        )
        self._thread.start()

    def stop(self) -> None:
        """Stops the processing thread and cleans up."""
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=5.0)
            
        if self.manifest:
            self._hub.unsubscribe(self.camera_id, self.manifest.id)

    def _run_loop(self) -> None:
        """Background thread loop that pulls frames from the hub and processes them."""
        logger.info(f"Plugin {self.manifest.id} started for camera {self.camera_id}")
        
        while not self._stop_event.is_set():
            frame, metadata = self._queue.get(timeout=1.0)
            
            if self._stop_event.is_set():
                break
                
            if frame is not None and metadata is not None:
                envelope = FrameEnvelope(metadata=metadata, frame_data=frame)
                try:
                    # Failure isolation: wrap plugin process in a broad except block
                    results = self.process(envelope)
                    self._handle_results(results)
                except Exception as e:
                    logger.error(f"Plugin {self.manifest.id} crashed processing frame {metadata.frame_id}: {e}")
                    # A real system might implement a circuit breaker or restart logic here.
                    # For now, we catch and log to ensure it doesn't kill the thread or the camera capture.
                    time.sleep(0.1) # Prevent tight loop on repeated failures
                    
    def _handle_results(self, results: List[DetectionResult]) -> None:
        """Override or connect to a sink (e.g. database, websocket) in a real implementation."""
        pass
