import time
import uuid
from datetime import datetime, timezone
from unittest.mock import patch

import numpy as np
import pytest

from app.core.ai.models import FrameEnvelope
from app.core.ai.yolo_plugin import YoloPlugin
from app.core.camera.hub import FrameHub
from app.core.camera.state import FrameMetadata


@pytest.fixture(autouse=True)
def cleanup():
    """Ensure clean hub state before and after each test."""
    hub = FrameHub()
    with hub._subs_lock:
        hub._subscriptions.clear()
    yield
    with hub._subs_lock:
        hub._subscriptions.clear()


def create_mock_metadata(frame_id: int, camera_id: uuid.UUID) -> FrameMetadata:
    return FrameMetadata(
        camera_id=camera_id,
        frame_id=frame_id,
        timestamp=datetime.now(timezone.utc),
        trace_id=f"trace_{frame_id}"
    )


def test_yolo_plugin_recorded_stream_inference():
    """
    Simulates a recorded stream by passing a synthetic frame to the actual YOLO model.
    Verifies that the model loads, processes the frame, and normalizes coordinates.
    """
    camera_id = uuid.uuid4()
    plugin = YoloPlugin(camera_id, confidence_threshold=0.1)
    plugin.initialize()
    
    # We call load() explicitly to fetch weights if not present
    plugin.load()
    
    # Create a dummy image (e.g., 640x480 black image with some random noise to prevent skipping)
    # A purely black image might not return any detections, but it shouldn't crash.
    frame_data = np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)
    
    metadata = create_mock_metadata(1, camera_id)
    envelope = FrameEnvelope(metadata=metadata, frame_data=frame_data)
    
    results = plugin.process(envelope)
    
    # We just want to ensure it processed successfully
    # Since it's random noise, it might or might not detect something depending on the noise
    assert isinstance(results, list)
    
    if results:
        # If it did detect something, verify normalization
        res = results[0]
        assert res.camera_id == camera_id
        assert res.processing_time_ms > 0
        assert 0.0 <= res.confidence <= 1.0
        
        # Verify coordinates are normalized
        for coord in res.bounding_box:
            assert 0.0 <= coord <= 1.0
            
    health = plugin.health()
    assert health["avg_inference_latency_ms"] > 0


def test_yolo_plugin_failure_isolation():
    """
    Verifies that if the YOLO model throws an OOM or unexpected error during process,
    it doesn't kill the plugin's background thread.
    """
    camera_id = uuid.uuid4()
    plugin = YoloPlugin(camera_id)
    plugin.initialize()
    
    # Setup mock to raise an exception on predict
    class MockYOLO:
        def predict(self, *args, **kwargs):
            raise RuntimeError("CUDA Out of Memory")
            
    plugin.model = MockYOLO()
    
    plugin.start() # Starts the thread and hub subscription
    
    hub = FrameHub()
    
    # Publish a frame
    frame_data = np.zeros((480, 640, 3), dtype=np.uint8)
    hub.publish(camera_id, frame_data, create_mock_metadata(1, camera_id))
    
    # Wait for the thread to attempt processing and catch the exception
    time.sleep(0.5)
    
    # Thread should still be alive
    assert plugin.health()["is_running"] is True
    
    plugin.stop()
