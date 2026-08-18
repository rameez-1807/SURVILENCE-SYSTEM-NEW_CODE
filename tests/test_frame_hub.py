import time
import uuid
from datetime import datetime, timezone

import pytest

from app.core.camera.hub import ConsumerStrategy, FrameHub
from app.core.camera.state import FrameMetadata


@pytest.fixture(autouse=True)
def cleanup_hub():
    """Ensure clean hub state."""
    hub = FrameHub()
    with hub._subs_lock:
        hub._subscriptions.clear()
    yield
    with hub._subs_lock:
        hub._subscriptions.clear()


def create_mock_metadata(frame_id: int) -> FrameMetadata:
    return FrameMetadata(
        camera_id=uuid.uuid4(),
        frame_id=frame_id,
        timestamp=datetime.now(timezone.utc),
        trace_id=f"trace_{frame_id}"
    )


def test_queue_saturation_latest():
    """Verify that LATEST strategy drops the oldest frames to keep the newest."""
    hub = FrameHub()
    camera_id = uuid.uuid4()
    
    # Max size 2
    q = hub.subscribe(camera_id, "preview", strategy=ConsumerStrategy.LATEST, max_size=2)
    
    # Publish 5 frames rapidly
    for i in range(1, 6):
        hub.publish(camera_id, f"frame_{i}", create_mock_metadata(i))
        
    health = hub.get_health(camera_id, "preview")
    assert health is not None
    assert health.queue_depth == 2
    assert health.dropped_frames == 3 # 5 - 2
    
    # Retrieve the 2 remaining frames. Since strategy is LATEST, they should be frame_4 and frame_5.
    f1, m1 = q.get()
    f2, m2 = q.get()
    
    assert f1 == "frame_4"
    assert f2 == "frame_5"


def test_queue_saturation_fifo():
    """Verify that FIFO strategy drops incoming frames if queue is full."""
    hub = FrameHub()
    camera_id = uuid.uuid4()
    
    # Max size 2
    q = hub.subscribe(camera_id, "analytics", strategy=ConsumerStrategy.FIFO, max_size=2)
    
    # Publish 5 frames rapidly
    for i in range(1, 6):
        hub.publish(camera_id, f"frame_{i}", create_mock_metadata(i))
        
    health = hub.get_health(camera_id, "analytics")
    assert health.queue_depth == 2
    assert health.dropped_frames == 3 # 5 - 2
    
    # Retrieve the 2 remaining frames. Since strategy is FIFO, they should be frame_1 and frame_2.
    f1, m1 = q.get()
    f2, m2 = q.get()
    
    assert f1 == "frame_1"
    assert f2 == "frame_2"


def test_slow_consumer_isolation():
    """
    Simulate a slow consumer and verify that `publish` returns instantly.
    The CaptureWorker thread must not be blocked.
    """
    hub = FrameHub()
    camera_id = uuid.uuid4()
    
    q = hub.subscribe(camera_id, "slow_ai", strategy=ConsumerStrategy.LATEST, max_size=5)
    
    start_time = time.time()
    
    # Publish 1000 frames instantly
    for i in range(1000):
        hub.publish(camera_id, f"frame_{i}", create_mock_metadata(i))
        
    end_time = time.time()
    
    # Publish should take virtually no time
    assert (end_time - start_time) < 0.1, "Publish blocked due to a slow consumer!"
    
    health = hub.get_health(camera_id, "slow_ai")
    assert health.queue_depth == 5
    assert health.dropped_frames == 995
