"""
Unit & Integration Tests for Facenox Biometrics, Template Encryption, and Attendance
"""

import pytest
import os
import base64
import json
from datetime import datetime
from zoneinfo import ZoneInfo

from app.core.biometrics import BiometricVault, biometric_vault
from app.schemas.employee import EmployeeResponse, EmployeeCheckIdResponse, EmployeeCreate
from app.api.v1.attendance import ATTENDANCE_TZ


def test_biometric_vault_roundtrip():
    """Verify AES-256-GCM authenticated encryption and decryption of 512-d embeddings."""
    vault = BiometricVault(secret_key="my-test-secret-key-32-bytes-long!")
    original_vector = [0.0123456 * i for i in range(512)]

    encrypted = vault.encrypt(original_vector, model_name="facenox-arcface-512d")
    assert encrypted["encrypted"] is True
    assert encrypted["algorithm"] == "AES-256-GCM"
    assert encrypted["dim"] == 512
    assert "nonce" in encrypted
    assert "ciphertext" in encrypted

    # Decrypt and verify
    decrypted = vault.decrypt(encrypted)
    assert decrypted is not None
    assert len(decrypted) == 512
    for orig, dec in zip(original_vector, decrypted):
        assert abs(orig - dec) < 1e-5


def test_biometric_vault_tamper_detection():
    """Verify that tampering with ciphertext triggers decryption failure (AEAD authentication tag)."""
    vault = BiometricVault(secret_key="test-key")
    vec = [0.5] * 128
    enc = vault.encrypt(vec)

    # Tamper with the ciphertext bytes
    raw_ct = base64.b64decode(enc["ciphertext"])
    tampered_ct = bytes([raw_ct[0] ^ 0xFF]) + raw_ct[1:]
    enc["ciphertext"] = base64.b64encode(tampered_ct).decode("utf-8")

    # Decryption should fail safely and return None (never crash)
    result = vault.decrypt(enc)
    assert result is None


def test_biometric_vault_legacy_support():
    """Ensure legacy unencrypted 128-d lists are handled transparently."""
    vault = BiometricVault(secret_key="test-key")
    legacy_vec = [0.1] * 128
    decrypted = vault.decrypt(legacy_vec)
    assert decrypted == legacy_vec

    meta = vault.get_template_metadata(legacy_vec)
    assert meta["is_enrolled"] is True
    assert meta["encrypted"] is False
    assert meta["dim"] == 128


def test_employee_response_is_enrolled_validator():
    """Test EmployeeResponse compute_is_enrolled validator with various payloads."""
    import uuid
    uid = uuid.uuid4()
    now = datetime.now()

    # Case 1: Encrypted dictionary
    enc_dict = biometric_vault.encrypt([0.1] * 512)
    resp1 = EmployeeResponse(
        id=uid,
        name="Rahul Sharma",
        employee_id="EMP-999",
        face_encoding=enc_dict,
        created_at=now,
    )
    assert resp1.is_enrolled is True
    assert resp1.biometric_model == "facenox-arcface-512d"

    # Case 2: Legacy list
    resp2 = EmployeeResponse(
        id=uid,
        name="Priya Patel",
        employee_id="EMP-998",
        face_encoding=[0.2] * 128,
        created_at=now,
    )
    assert resp2.is_enrolled is True
    assert resp2.biometric_model == "legacy-face-api"

    # Case 3: None
    resp3 = EmployeeResponse(
        id=uid,
        name="Unenrolled Staff",
        employee_id="EMP-997",
        face_encoding=None,
        created_at=now,
    )
    assert resp3.is_enrolled is False


def test_attendance_timezone_kolkata():
    """Verify that attendance timezone defaults to Asia/Kolkata."""
    assert str(ATTENDANCE_TZ) == "Asia/Kolkata"
    now_ist = datetime.now(ATTENDANCE_TZ)
    assert now_ist.tzinfo is not None


@pytest.mark.asyncio
async def test_employee_check_id_api(client):
    """Test GET /api/v1/employees/check-id/{employee_id} for non-existent and existent IDs."""
    async with client:
        # Check non-existent ID
        res = await client.get("/api/v1/employees/check-id/NON-EXISTENT-ID")
        assert res.status_code == 200
        data = res.json()
        assert data["exists"] is False
        assert data["employee_id"] == "NON-EXISTENT-ID"

        # Register employee
        reg_res = await client.post("/api/v1/employees/register", json={
            "name": "Arun Kumar",
            "employee_id": "EMP-ARUN-001",
            "department": "Engineering",
            "designation": "AI Architect"
        })
        assert reg_res.status_code == 201

        # Check existent ID
        res2 = await client.get("/api/v1/employees/check-id/EMP-ARUN-001")
        assert res2.status_code == 200
        data2 = res2.json()
        assert data2["exists"] is True
        assert data2["name"] == "Arun Kumar"
        assert data2["department"] == "Engineering"


@pytest.mark.asyncio
async def test_employee_duplicate_id_conflict(client):
    """Ensure duplicate employee IDs return 409 Conflict."""
    async with client:
        payload = {
            "name": "Sunita Verma",
            "employee_id": "EMP-DUP-101",
            "department": "HR"
        }
        res1 = await client.post("/api/v1/employees/register", json=payload)
        assert res1.status_code == 201

        # Duplicate registration
        res2 = await client.post("/api/v1/employees/register", json=payload)
        assert res2.status_code == 409
        assert "already exists" in res2.json()["detail"].lower()


@pytest.mark.asyncio
async def test_employee_face_removal(client):
    """Ensure removing an employee's face preserves the profile but clears biometric enrollment."""
    async with client:
        # Register employee with 512-d ArcFace vector
        reg_res = await client.post("/api/v1/employees/register", json={
            "name": "Kavita Rao",
            "employee_id": "EMP-KAVITA-002",
            "face_encoding": [0.05] * 512
        })
        assert reg_res.status_code == 201
        assert reg_res.json()["is_enrolled"] is True

        # Delete face template
        del_res = await client.delete("/api/v1/employees/EMP-KAVITA-002/face")
        assert del_res.status_code == 200
        assert del_res.json()["is_enrolled"] is False

        # Check ID should now show enrolled=False
        chk_res = await client.get("/api/v1/employees/check-id/EMP-KAVITA-002")
        assert chk_res.status_code == 200
        assert chk_res.json()["is_enrolled"] is False
