import pytest
import uuid
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_recognition_history_api_flow():
    """Test creating and querying recognition history records via API."""
    emp_id = f"EMP-HIST-{uuid.uuid4().hex[:4].upper()}"
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Create history record
        create_res = await ac.post("/api/v1/recognition-history", json={
            "employee_id": emp_id,
            "employee_name": "Audit Test User",
            "confidence": 92.4,
            "camera_name": "Lobby Feed",
            "status": "Recognized"
        })
        assert create_res.status_code == 201
        rec = create_res.json()
        assert rec["employee_id"] == emp_id
        assert rec["status"] == "Recognized"

        # Query history with employee filter
        get_res = await ac.get(f"/api/v1/recognition-history?employee={emp_id}")
        assert get_res.status_code == 200
        data = get_res.json()
        assert data["total"] >= 1
        assert data["items"][0]["employee_id"] == emp_id
        assert data["items"][0]["confidence"] == 92.4
        assert data["items"][0]["camera_name"] == "Lobby Feed"

        # Query history with status filter
        status_res = await ac.get(f"/api/v1/recognition-history?status=Recognized")
        assert status_res.status_code == 200
        assert status_res.json()["total"] >= 1
