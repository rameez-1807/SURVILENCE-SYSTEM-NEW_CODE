import time
import uuid
from datetime import datetime, timezone

import pytest

from app.core.ai.mock_plugin import MockPlugin
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


def test_plugin_contract():
    """Verifies that the MockPlugin implements the AIPlugin contract properly."""
    camera_id = uuid.uuid4()
    plugin = MockPlugin(camera_id)
    
    # Lifecycle
    plugin.initialize()
    plugin.load()
    plugin.start()
    
    # Ensure it's healthy
    health = plugin.health()
    assert health["is_running"] is True
    assert health["manifest"]["id"] == "mock-plugin-v1"
    
    # Publish a frame to the hub
    hub = FrameHub()
    hub.publish(camera_id, "dummy_frame_data", create_mock_metadata(1, camera_id))
    
    # Wait for processing
    time.sleep(0.5)
    
    # Verify results
    assert len(plugin.latest_results) == 1
    result = plugin.latest_results[0]
    
    assert result.camera_id == camera_id
    assert result.frame_id == 1
    assert result.confidence == 0.99
    assert result.label == "person"
    assert len(result.bounding_box) == 4
    
    plugin.stop()
    assert plugin.health()["is_running"] is False


def test_plugin_failure_isolation():
    """
    Verifies that if a plugin crashes during process(), it catches the exception,
    logs it, and continues running for subsequent frames without crashing the thread.
    """
    camera_id = uuid.uuid4()
    # Configure to fail on frame 2
    plugin = MockPlugin(camera_id, fail_on_frame=2)
    
    plugin.initialize()
    plugin.start()
    
    hub = FrameHub()
    
    # Frame 1 - Success
    hub.publish(camera_id, "frame1", create_mock_metadata(1, camera_id))
    time.sleep(0.1)
    assert len(plugin.latest_results) == 1
    assert plugin.latest_results[0].frame_id == 1
    
    # Frame 2 - Crash!
    hub.publish(camera_id, "frame2", create_mock_metadata(2, camera_id))
    time.sleep(0.2) # wait for crash handling
    
    # Verify it is STILL RUNNING
    assert plugin.health()["is_running"] is True
    # Results should not have updated
    assert plugin.latest_results[0].frame_id == 1
    
    # Frame 3 - Success (Recovery)
    hub.publish(camera_id, "frame3", create_mock_metadata(3, camera_id))
    time.sleep(0.2)
    assert plugin.latest_results[0].frame_id == 3
    
    plugin.stop()
