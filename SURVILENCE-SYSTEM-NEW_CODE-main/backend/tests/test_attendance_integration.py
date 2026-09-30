"""
Integration tests for Attendance Creation & Duplicate Protection.
"""

import pytest
from datetime import date, time
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.repositories.attendance import AttendanceRepository
from app.repositories.employee import EmployeeRepository
from tests.conftest import TestSessionLocal


@pytest.mark.asyncio
async def test_attendance_creation_and_duplicate_protection():
    """Test creating an attendance record and duplicate protection logic."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Register employee first
        emp_res = await ac.post("/api/v1/employees/register", json={
            "name": "Rameez Ahmad",
            "employee_id": "EMP-ATT-001",
            "department": "Security",
            "face_encoding": [0.01 * i for i in range(128)]
        })
        assert emp_res.status_code == 201

        # 2. First attendance check-in
        att_payload1 = {
            "employee_id": "EMP-ATT-001",
            "attendance_date": "2026-08-20",
            "first_seen": "09:30:00",
            "last_seen": "09:30:00",
            "camera_name": "Live Camera",
            "confidence": 95.0
        }
        res1 = await ac.post("/api/v1/attendance", json=att_payload1)
        assert res1.status_code == 201, res1.text
        data1 = res1.json()
        assert data1["employee_name"] == "Rameez Ahmad"
        assert data1["employee_id"] == "EMP-ATT-001"
        assert data1["first_seen"] == "09:30:00"
        assert data1["last_seen"] == "09:30:00"

        # 3. Second attendance check-in on the same date (duplicate protection check)
        att_payload2 = {
            "employee_id": "EMP-ATT-001",
            "attendance_date": "2026-08-20",
            "first_seen": "09:45:00",
            "last_seen": "09:45:00",
            "camera_name": "Live Camera",
            "confidence": 98.0
        }
        res2 = await ac.post("/api/v1/attendance", json=att_payload2)
        assert res2.status_code == 201
        data2 = res2.json()
        # Same record ID retained, first_seen stays 09:30:00, last_seen updated to 09:45:00!
        assert data2["id"] == data1["id"]
        assert data2["first_seen"] == "09:30:00"
        assert data2["last_seen"] == "09:45:00"
        assert data2["confidence"] == 98.0

    # 4. Directly verify SQLite database table attendance_records count
    async with TestSessionLocal() as session:
        emp_repo = EmployeeRepository(session)
        emp = await emp_repo.get_by_employee_id("EMP-ATT-001")
        assert emp is not None

        att_repo = AttendanceRepository(session)
        record = await att_repo.get_by_employee_and_date(emp.id, date(2026, 8, 20))
        assert record is not None
        assert record.first_seen == time(9, 30, 0)
        assert record.last_seen == time(9, 45, 0)

        # Count total records for this date
        total, items = await att_repo.list_records(filter_date=date(2026, 8, 20), filter_employee_id="EMP-ATT-001")
        assert total == 1, "Duplicate protection failed: more than 1 record found for same date!"


@pytest.mark.asyncio
async def test_attendance_unregistered_employee_rejected():
    """Test attendance creation fails for unregistered employee_id with 404 Not Found."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        payload = {
            "employee_id": "NON-EXISTENT-EMP",
            "attendance_date": "2026-08-20",
            "first_seen": "10:00:00",
            "last_seen": "10:00:00",
            "camera_name": "Live Camera",
            "confidence": 90.0
        }
        response = await ac.post("/api/v1/attendance", json=payload)
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()
