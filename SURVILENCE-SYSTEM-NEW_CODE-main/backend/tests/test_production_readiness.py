import math
import uuid
import pytest
from datetime import date
from httpx import AsyncClient, ASGITransport
from app.main import app

def l2_normalize(vector: list[float]) -> list[float]:
    norm = math.sqrt(sum(x * x for x in vector)) or 1.0
    return [x / norm for x in vector]

@pytest.mark.asyncio
async def test_full_production_scenarios():
    """Comprehensive test covering all 3 required real-world production scenarios."""
    emp_id = f"EMP-PROD-{uuid.uuid4().hex[:4].upper()}"
    raw_vec = [0.15 + (i % 7) * 0.05 for i in range(128)]
    known_vec = l2_normalize(raw_vec)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # --- SCENARIO 1: REGISTER EMPLOYEE & SAVE PERMANENTLY ---
        reg_res = await ac.post("/api/v1/employees/register", json={
            "name": "Production Test Employee",
            "employee_id": emp_id,
            "department": "Security Ops",
            "designation": "Lead Officer",
            "face_encoding": known_vec
        })
        assert reg_res.status_code == 201
        registered_data = reg_res.json()
        assert registered_data["employee_id"] == emp_id

        # --- RECOGNIZE REGISTERED FACE ---
        rec_res = await ac.post("/api/v1/employees/recognize", json={
            "face_encoding": known_vec
        })
        assert rec_res.status_code == 200
        match_data = rec_res.json()
        assert match_data["match_found"] is True
        assert match_data["employee"]["employee_id"] == emp_id
        assert match_data["confidence"] > 0.90

        # --- MARK ATTENDANCE ONCE & TEST DUPLICATE PROTECTION ---
        att_res = await ac.post("/api/v1/attendance", json={
            "employee_id": emp_id,
            "attendance_date": str(date.today()),
            "first_seen": "09:00:00",
            "last_seen": "09:00:00",
            "camera_name": "Front Gate",
            "confidence": round(match_data["confidence"] * 100.0, 1)
        })
        assert att_res.status_code == 201
        att_data = att_res.json()
        first_id = att_data["id"]

        # Duplicate check-in on same day updates last_seen without creating extra row
        att_dup_res = await ac.post("/api/v1/attendance", json={
            "employee_id": emp_id,
            "attendance_date": str(date.today()),
            "first_seen": "09:30:00",
            "last_seen": "09:30:00",
            "camera_name": "Front Gate",
            "confidence": 99.0
        })
        assert att_dup_res.status_code == 201
        assert att_dup_res.json()["id"] == first_id

        # --- VERIFY RECOGNITION HISTORY RECORD SAVED ---
        hist_res = await ac.get(f"/api/v1/recognition-history?employee={emp_id}")
        assert hist_res.status_code == 200
        hist_data = hist_res.json()
        assert hist_data["total"] >= 1
        assert hist_data["items"][0]["employee_id"] == emp_id
        assert hist_data["items"][0]["status"] == "Recognized"

        # --- SCENARIO 2: UNKNOWN FACE REJECTION ---
        unknown_raw = [0.8 if (i % 2 == 0) else -0.8 for i in range(128)]
        unknown_vec = l2_normalize(unknown_raw)
        unk_res = await ac.post("/api/v1/employees/recognize", json={
            "face_encoding": unknown_vec
        })
        assert unk_res.status_code == 200
        assert unk_res.json()["match_found"] is False

        # --- SCENARIO 3: REMOVE FACE -> PROFILE REMAINS -> CANNOT BE RECOGNIZED ---
        del_face_res = await ac.delete(f"/api/v1/employees/{emp_id}/face")
        assert del_face_res.status_code == 200
        assert del_face_res.json()["employee_id"] == emp_id

        # Face recognition with previous encoding must now fail
        rec_after_del = await ac.post("/api/v1/employees/recognize", json={
            "face_encoding": known_vec
        })
        assert rec_after_del.status_code == 200
        assert rec_after_del.json()["match_found"] is False

        # Verify employee still exists in list
        list_res = await ac.get("/api/v1/employees")
        assert list_res.status_code == 200
        ids = [e["employee_id"] for e in list_res.json()["items"]]
        assert emp_id in ids
