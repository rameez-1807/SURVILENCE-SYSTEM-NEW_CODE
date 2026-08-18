"""
AI Surveillance System - Frame Hub

Pub/Sub architecture to distribute frames from Camera Manager to downstream consumers (AI, preview, analytics).
Implements bounded queues, backpressure, and stale frame dropping to prevent slow consumers from blocking capture.
"""

import enum
import logging
import queue
import threading
import uuid
from typing import Any, Dict, Optional, Tuple

from pydantic import BaseModel

from app.core.camera.state import FrameMetadata

logger = logging.getLogger(__name__)


class ConsumerStrategy(str, enum.Enum):
    """
    Queue full handling strategy.
    LATEST: Drop the oldest frame in the queue to make room for the new one (good for Preview/AI).
    FIFO: Drop the incoming frame if the queue is full (good for strict chronological processing).
    """
    LATEST = "latest"
    FIFO = "fifo"


class ConsumerHealth(BaseModel):
    """Health metrics for a single consumer."""
    queue_depth: int = 0
    dropped_frames: int = 0
    processed_frames: int = 0


class ConsumerQueue:
    """Thread-safe bounded queue with backpressure handling for a single consumer."""
    
    def __init__(self, name: str, max_size: int = 10, strategy: ConsumerStrategy = ConsumerStrategy.LATEST):
        self.name = name
        self.strategy = strategy
        self._queue: queue.Queue = queue.Queue(maxsize=max_size)
        
        self._dropped_frames = 0
        self._processed_frames = 0
        self._lock = threading.Lock()

    def put(self, frame: Any, metadata: FrameMetadata) -> None:
        """
        Non-blocking put.
        If queue is full, applies backpressure strategy.
        """
        try:
            self._queue.put_nowait((frame, metadata))
        except queue.Full:
            if self.strategy == ConsumerStrategy.LATEST:
                # Drop oldest frame
                try:
                    self._queue.get_nowait()
                    with self._lock:
                        self._dropped_frames += 1
                except queue.Empty:
                    pass # Race condition, it's fine
                
                # Retry put
                try:
                    self._queue.put_nowait((frame, metadata))
                except queue.Full:
                    # Very rare race condition where another producer filled it instantly
                    with self._lock:
                        self._dropped_frames += 1
            else:
                # FIFO backpressure: Drop incoming frame
                with self._lock:
                    self._dropped_frames += 1

    def get(self, timeout: Optional[float] = None) -> Tuple[Optional[Any], Optional[FrameMetadata]]:
        """
        Retrieves next frame for consumer.
        """
        try:
            item = self._queue.get(timeout=timeout)
            with self._lock:
                self._processed_frames += 1
            return item
        except queue.Empty:
            return None, None

    def get_health(self) -> ConsumerHealth:
        with self._lock:
            return ConsumerHealth(
                queue_depth=self._queue.qsize(),
                dropped_frames=self._dropped_frames,
                processed_frames=self._processed_frames
            )


class FrameHub:
    """
    Singleton Hub to manage frame distribution.
    CameraManager / CaptureWorker publishes to this hub.
    Consumers subscribe to get a ConsumerQueue.
    """
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(FrameHub, cls).__new__(cls)
                cls._instance._init_state()
            return cls._instance

    def _init_state(self):
        # dict mapping camera_id -> { consumer_name -> ConsumerQueue }
        self._subscriptions: Dict[uuid.UUID, Dict[str, ConsumerQueue]] = {}
        self._subs_lock = threading.Lock()

    def subscribe(
        self,
        camera_id: uuid.UUID,
        consumer_name: str,
        strategy: ConsumerStrategy = ConsumerStrategy.LATEST,
        max_size: int = 10
    ) -> ConsumerQueue:
        """Registers a new consumer for a camera."""
        with self._subs_lock:
            if camera_id not in self._subscriptions:
                self._subscriptions[camera_id] = {}
            
            if consumer_name in self._subscriptions[camera_id]:
                logger.warning(f"Consumer {consumer_name} already subscribed to camera {camera_id}. Replacing queue.")
                
            q = ConsumerQueue(name=consumer_name, max_size=max_size, strategy=strategy)
            self._subscriptions[camera_id][consumer_name] = q
            return q

    def unsubscribe(self, camera_id: uuid.UUID, consumer_name: str) -> None:
        """Removes a consumer subscription."""
        with self._subs_lock:
            if camera_id in self._subscriptions:
                self._subscriptions[camera_id].pop(consumer_name, None)
                if not self._subscriptions[camera_id]:
                    del self._subscriptions[camera_id]

    def publish(self, camera_id: uuid.UUID, frame: Any, metadata: FrameMetadata) -> None:
        """
        Pushes frame to all subscribed consumers.
        This is non-blocking to isolate the slow consumers from the publisher (CaptureWorker).
        """
        with self._subs_lock:
            subs = self._subscriptions.get(camera_id)
            if not subs:
                return
            
            # Use list to iterate safely just in case it mutates
            queues = list(subs.values())
            
        for q in queues:
            q.put(frame, metadata)

    def get_health(self, camera_id: uuid.UUID, consumer_name: str) -> Optional[ConsumerHealth]:
        """Gets health metrics for a specific consumer."""
        with self._subs_lock:
            subs = self._subscriptions.get(camera_id)
            if subs and consumer_name in subs:
                return subs[consumer_name].get_health()
        return None
