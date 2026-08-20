import pytest
import uuid
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_recognition_dashboard_stats_api():
    """Test face recognition dashboard stats API endpoint."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Fetch initial stats
        res = await ac.get("/api/v1/recognition-history/stats?period=today")
        assert res.status_code == 200
        stats = res.json()
        
        assert "total_registered_employees" in stats
        assert "recognized_faces_today" in stats
        assert "unknown_faces_today" in stats
        assert "attendance_marked_today" in stats
        assert "trend_data" in stats
        assert "distribution_data" in stats
        assert "recent_activity" in stats

        initial_recognized = stats["recognized_faces_today"]

        # Post a new recognition event
        emp_id = f"EMP-DASH-{uuid.uuid4().hex[:4].upper()}"
        post_res = await ac.post("/api/v1/recognition-history", json={
            "employee_id": emp_id,
            "employee_name": "Dashboard Stat Test",
            "confidence": 97.2,
            "camera_name": "East Gate",
            "status": "Recognized"
        })
        assert post_res.status_code == 201

        # Re-fetch stats and verify count updated
        res_updated = await ac.get("/api/v1/recognition-history/stats?period=today")
        assert res_updated.status_code == 200
        updated_stats = res_updated.json()
        assert updated_stats["recognized_faces_today"] == initial_recognized + 1
        assert updated_stats["recent_activity"][0]["employee_id"] == emp_id
