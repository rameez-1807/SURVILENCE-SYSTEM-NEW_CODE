"""
Tests for Employee Registration & Face Encoding Storage.
"""

import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.repositories.employee import EmployeeRepository
from tests.conftest import TestSessionLocal


@pytest.mark.asyncio
async def test_register_employee_success():
    """Test registering a new employee with a 128-d face encoding."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        dummy_encoding = [0.1 * i for i in range(128)]
        payload = {
            "name": "Jane Doe",
            "employee_id": "EMP-2001",
            "department": "AI Research",
            "designation": "Computer Vision Engineer",
            "face_encoding": dummy_encoding
        }
        response = await ac.post("/api/v1/employees/register", json=payload)
        assert response.status_code == 201, response.text
        data = response.json()
        assert data["name"] == "Jane Doe"
        assert data["employee_id"] == "EMP-2001"
        assert data["is_enrolled"] is True

    # Verify DB persistence directly
    async with TestSessionLocal() as session:
        repo = EmployeeRepository(session)
        emp = await repo.get_by_employee_id("EMP-2001")
        assert emp is not None
        assert emp.name == "Jane Doe"
        assert emp.face_encoding is not None
        assert len(emp.face_encoding) == 128
        assert emp.face_encoding[0] == 0.0


@pytest.mark.asyncio
async def test_register_employee_duplicate_id():
    """Test duplicate employee registration returns 409 Conflict."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        dummy_encoding = [0.05 * i for i in range(128)]
        payload = {
            "name": "First User",
            "employee_id": "EMP-DUP-1",
            "face_encoding": dummy_encoding
        }
        res1 = await ac.post("/api/v1/employees/register", json=payload)
        assert res1.status_code == 201

        # Attempt to register again with same employee_id
        res2 = await ac.post("/api/v1/employees/register", json=payload)
        assert res2.status_code == 409
        assert "Employee with this ID already exists" in res2.json()["detail"]


@pytest.mark.asyncio
async def test_register_employee_invalid_dimension():
    """Test registering employee with invalid face encoding length returns 400 Bad Request."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        invalid_encoding = [0.1] * 50  # 50 dims instead of 128
        payload = {
            "name": "Invalid User",
            "employee_id": "EMP-BAD-DIM",
            "face_encoding": invalid_encoding
        }
        response = await ac.post("/api/v1/employees/register", json=payload)
        assert response.status_code == 400
        assert "Must be 128-dimensional array" in response.json()["detail"]


@pytest.mark.asyncio
async def test_recognize_registered_employee():
    """Test face recognition endpoint with registered face encoding."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        vector = [0.01 * i for i in range(128)]
        # 1. Register employee
        await ac.post("/api/v1/employees/register", json={
            "name": "Alice Smith",
            "employee_id": "EMP-REC-1",
            "face_encoding": vector
        })

        # 2. Query recognize with identical vector
        rec_res = await ac.post("/api/v1/employees/recognize", json={
            "face_encoding": vector
        })
        assert rec_res.status_code == 200
        rec_data = rec_res.json()
        assert rec_data["match_found"] is True
        assert rec_data["employee"]["employee_id"] == "EMP-REC-1"
        assert rec_data["employee"]["name"] == "Alice Smith"
