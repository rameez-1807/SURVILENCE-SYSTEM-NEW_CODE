import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_detect_object_and_persist_db():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Post object detection event
        payload = {
            "object_class": "mobile phone",
            "confidence": 0.94,
            "camera_name": "Scanner Test Cam",
            "evidence_reference": "Scanned Mobile Phone"
        }
        res = await client.post("/api/v1/events/detect-object", json=payload)
        assert res.status_code == 201
        data = res.json()
        assert data["event_type"] == "mobile_phone_detected"
        assert data["confidence"] == 0.94

        # 2. Query events list to confirm permanent persistence in database
        res_list = await client.get("/api/v1/events")
        assert res_list.status_code == 200
        events = res_list.json()
        assert any(e["event_type"] == "mobile_phone_detected" for e in events)
