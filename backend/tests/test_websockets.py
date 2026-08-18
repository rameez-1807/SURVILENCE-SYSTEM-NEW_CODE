import asyncio
import json
import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.security import create_access_token
from app.models.membership import Role
from app.schemas.event import EventCreate
from app.services.event import EventService
from app.core.websockets.manager import ws_manager
from tests.conftest import create_test_user, create_test_tenant_and_membership, TestSessionLocal

client = TestClient(app)

@pytest.fixture
def auth_token():
    async def _get_token(role: Role = Role.OPERATOR, return_details: bool = False):
        user = await create_test_user(f"ws_user_{uuid.uuid4().hex[:6]}@test.com", "pass")
        tenant, _ = await create_test_tenant_and_membership(user.id, role)
        token = create_access_token(subject=str(user.id))
        if return_details:
            return token, tenant.id, user.id
        return token, tenant.id
    return _get_token

@pytest.mark.asyncio
async def test_websocket_unauthorized():
    # Should fail with 1008 if no token
    with pytest.raises(Exception) as exc_info:
        with client.websocket_connect("/api/v1/ws") as websocket:
            websocket.close()
    assert exc_info.value.code in [1008, 403, 422, 1003]
    await asyncio.sleep(0.1)

@pytest.mark.asyncio
async def test_websocket_invalid_token():
    with pytest.raises(Exception) as exc_info:
        with client.websocket_connect("/api/v1/ws?token=invalid") as websocket:
            websocket.close()
    assert exc_info.value.code in [1008, 401]
    await asyncio.sleep(0.1)

@pytest.mark.asyncio
async def test_websocket_authenticated_and_heartbeat(auth_token):
    token, tenant_id = await auth_token()
    
    with client.websocket_connect(f"/api/v1/ws?token={token}&tenant_id={tenant_id}") as websocket:
        # Test heartbeat ping/pong
        websocket.send_json({"type": "ping"})
        data = websocket.receive_json()
        assert data["type"] == "pong"
        assert "timestamp" in data
        websocket.close()
    await asyncio.sleep(0.1)

@pytest.mark.asyncio
async def test_websocket_tenant_isolation(auth_token):
    token1, tenant_id1 = await auth_token()
    token2, tenant_id2 = await auth_token()
    
    # User 1 tries to connect to Tenant 2
    with pytest.raises(Exception) as exc_info:
        with client.websocket_connect(f"/api/v1/ws?token={token1}&tenant_id={tenant_id2}") as websocket:
            websocket.close()
    assert exc_info.value.code == 1003
    await asyncio.sleep(0.1)

@pytest.mark.asyncio
async def test_websocket_event_delivery(auth_token):
    token, tenant_id = await auth_token()
    
    # Manually create site and camera for the event delivery test
    from app.models.site import Site
    from app.models.camera import Camera
    
    site_id = uuid.uuid4()
    camera_id = uuid.uuid4()
    
    async with TestSessionLocal() as session:
        site = Site(id=site_id, tenant_id=tenant_id, name="WS Site")
        camera = Camera(id=camera_id, tenant_id=tenant_id, site_id=site_id, name="WS Cam", host="127.0.0.1", stream_path="/live")
        session.add(site)
        session.add(camera)
        await session.commit()
    
    with client.websocket_connect(f"/api/v1/ws?token={token}&tenant_id={tenant_id}") as websocket:
        
        # Subscribe to specific site
        websocket.send_json({"type": "subscribe", "site_id": str(site_id)})
        resp = websocket.receive_json()
        assert resp["type"] == "subscribed"
        
        # Now trigger an event in the backend
        event_in = EventCreate(
            tenant_id=tenant_id,
            site_id=site_id,
            camera_id=camera_id,
            event_type="test_ws_event",
            severity="high",
            state="OPEN",
            observed_at="2026-08-13T10:00:00Z",
            confidence=0.9,
            model_id="yolo",
            model_version="1",
            dedupe_key=f"ws_key_{uuid.uuid4()}"
        )
        
        async with TestSessionLocal() as session:
            event = await EventService.create_event(session, event_in)
            await session.commit()
            
        # The websocket should receive it
        data = websocket.receive_json()
        assert data["type"] == "event.created"
        assert data["data"]["id"] == str(event.id)
        assert data["data"]["event_type"] == "test_ws_event"
        
        # Test transition state
        async with TestSessionLocal() as session:
            updated = await EventService.transition_state(session, event.id, "ACKNOWLEDGED")
            await session.commit()
            
        data2 = websocket.receive_json()
        assert data2["type"] == "event.updated"
        assert data2["data"]["state"] == "ACKNOWLEDGED"
        websocket.close()
    await asyncio.sleep(0.1)

@pytest.mark.asyncio
async def test_websocket_sequence_and_reconnect(auth_token):
    token, tenant_id = await auth_token()
    
    # Pre-populate some messages in the WS manager for this tenant
    await ws_manager.broadcast_event(tenant_id, {"id": "1", "msg": "a"}, action="test")
    await ws_manager.broadcast_event(tenant_id, {"id": "2", "msg": "b"}, action="test")
    await ws_manager.broadcast_event(tenant_id, {"id": "3", "msg": "c"}, action="test")
    
    # We want to connect and request last_seen_sequence = 1
    # Note: We need to know the sequence numbers. Let's assume the first message was sequence 1 if fresh manager.
    # To be safe, let's just get the buffer's sequences directly for the test.
    buffer = list(ws_manager._message_buffer[tenant_id])
    if not buffer:
        pytest.skip("Buffer empty")
        
    seq2 = buffer[1]["seq"]
    
    with client.websocket_connect(f"/api/v1/ws?token={token}&tenant_id={tenant_id}") as websocket:
        # Send subscribe with last_seen_sequence
        websocket.send_json({"type": "subscribe", "last_seen_sequence": seq2})
        resp = websocket.receive_json()
        assert resp["type"] == "subscribed"
        
        # Should replay the 3rd message
        replayed = websocket.receive_json()
        assert replayed["type"] == "test"
        assert replayed["data"]["id"] == "3"
        assert replayed["seq"] > seq2
        websocket.close()
    await asyncio.sleep(0.1)

