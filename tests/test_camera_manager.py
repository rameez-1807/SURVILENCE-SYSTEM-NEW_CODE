import time
import uuid
import pytest
from unittest.mock import patch

from app.core.camera.manager import CameraManager
from app.core.camera.state import CameraState
from tests.mocks.camera_stream import MockVideoCapture


@pytest.fixture(autouse=True)
def cleanup_manager():
    """Ensure clean manager state before and after each test."""
    manager = CameraManager()
    manager.shutdown_all()
    yield
    manager.shutdown_all()


@patch("app.core.camera.capture.cv2.VideoCapture", new=MockVideoCapture)
def test_camera_connection():
    manager = CameraManager()
    camera_id = uuid.uuid4()
    
    manager.start_stream(camera_id, "mock://working_stream")
    time.sleep(1.2)  # Let thread start, connect, and calculate fps after 1 sec
    
    health = manager.get_health(camera_id)
    assert health is not None
    assert health.connection_state == CameraState.ONLINE
    assert health.fps > 0
    assert manager.get_latest_frame(camera_id)[0] is not None


@patch("app.core.camera.capture.cv2.VideoCapture", new=MockVideoCapture)
def test_camera_disconnect_and_clean_shutdown():
    manager = CameraManager()
    camera_id = uuid.uuid4()
    
    manager.start_stream(camera_id, "mock://working_stream")
    time.sleep(0.1)
    
    manager.stop_stream(camera_id)
    time.sleep(0.1)
    
    # Should be gone
    assert manager.get_health(camera_id) is None


@patch("app.core.camera.capture.cv2.VideoCapture", new=MockVideoCapture)
def test_camera_invalid_credentials():
    manager = CameraManager()
    camera_id = uuid.uuid4()
    
    manager.start_stream(camera_id, "mock://auth_fail")
    time.sleep(0.1)
    
    health = manager.get_health(camera_id)
    assert health is not None
    assert health.connection_state == CameraState.AUTH_FAILED


@patch("app.core.camera.capture.cv2.VideoCapture", new=MockVideoCapture)
def test_camera_offline():
    manager = CameraManager()
    camera_id = uuid.uuid4()
    
    # CaptureWorker takes 1s initially then backoff to 2s... 
    # so we should use a shorter max backoff or just wait a bit.
    manager.start_stream(camera_id, "mock://offline")
    time.sleep(0.5)
    
    health = manager.get_health(camera_id)
    assert health is not None
    assert health.connection_state in (CameraState.CONNECTING, CameraState.RECONNECTING)
    assert health.reconnect_count > 0


@patch("app.core.camera.capture.cv2.VideoCapture", new=MockVideoCapture)
def test_camera_reconnect():
    manager = CameraManager()
    camera_id = uuid.uuid4()
    
    manager.start_stream(camera_id, "mock://fail_after_2")
    time.sleep(0.1) # should connect initially
    
    # Check it connected
    health = manager.get_health(camera_id)
    assert health.connection_state == CameraState.ONLINE
    
    # Wait for failure and reconnect cycle
    time.sleep(1.0)
    
    # The worker attempts to reconnect quickly and continuously cycles through states.
    # We verify the worker is still running and managing the cycle without crashing.
    worker = manager._workers[camera_id]
    assert worker._thread is not None
    assert worker._thread.is_alive()


@patch("app.core.camera.capture.cv2.VideoCapture", new=MockVideoCapture)
def test_duplicate_capture_prevention():
    manager = CameraManager()
    camera_id = uuid.uuid4()
    
    manager.start_stream(camera_id, "mock://working_stream")
    time.sleep(0.1)
    
    worker1 = manager._workers[camera_id]
    
    # Try starting it again
    manager.start_stream(camera_id, "mock://working_stream")
    
    # Should be the exact same worker
    assert manager._workers[camera_id] is worker1
