"""
Tests for the Camera Management API.

Verifies CRUD operations, Tenant/Site isolation, and secure credential handling.
"""

import uuid
import json

import pytest
from httpx import AsyncClient

from app.core.security import create_access_token
from app.models.camera import CameraStatus
from app.models.membership import Role
from app.models.site import Site
from tests.conftest import TestSessionLocal, create_test_tenant_and_membership, create_test_user


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def create_test_site(tenant_id: uuid.UUID, name: str = "Test Site"):
    """Helper to bypass API and create a site in the test DB."""
    async with TestSessionLocal() as session:
        site = Site(
            tenant_id=tenant_id,
            name=name,
            timezone="UTC",
            address_json=json.dumps({"city": "Test"})
        )
        session.add(site)
        await session.commit()
        await session.refresh(site)
        return site


async def get_auth_headers(user_id: uuid.UUID, tenant_id: uuid.UUID):
    """Helper to generate headers for an authenticated user accessing a tenant."""
    token = create_access_token(subject=str(user_id))
    return {
        "Authorization": f"Bearer {token}",
        "X-Tenant-ID": str(tenant_id)
    }


# ===========================================================================
# CREATE
# ===========================================================================

class TestCreateCamera:
    @pytest.mark.asyncio
    async def test_create_camera_success(self, client: AsyncClient):
        async with client:
            user = await create_test_user("cam1@test.com", "pass")
            tenant, _ = await create_test_tenant_and_membership(user.id, Role.INSTALLER)
            site = await create_test_site(tenant.id)
            headers = await get_auth_headers(user.id, tenant.id)

            payload = {
                "tenant_id": str(tenant.id),
                "site_id": str(site.id),
                "name": "Front Door Camera",
                "host": "192.168.1.100",
                "stream_path": "/cam/realmonitor?channel=1&subtype=0",
                "credential_reference": "vault/secret/path",
            }
            resp = await client.post("/api/v1/cameras", json=payload, headers=headers)

        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Front Door Camera"
        assert data["status"] == CameraStatus.PENDING_TEST
        assert "id" in data
        # SECURITY CHECK: credential_reference MUST NOT BE RETURNED
        assert "credential_reference" not in data

    @pytest.mark.asyncio
    async def test_create_camera_wrong_tenant_fails(self, client: AsyncClient):
        async with client:
            user = await create_test_user("cam2@test.com", "pass")
            tenant, _ = await create_test_tenant_and_membership(user.id, Role.INSTALLER)
            site = await create_test_site(tenant.id)
            headers = await get_auth_headers(user.id, tenant.id)

            other_tenant_id = str(uuid.uuid4())
            payload = {
                "tenant_id": other_tenant_id,  # User trying to assign camera to a tenant they don't own
                "site_id": str(site.id),
                "name": "Hacked Camera",
                "host": "192.168.1.100",
                "stream_path": "/cam",
            }
            resp = await client.post("/api/v1/cameras", json=payload, headers=headers)

        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_create_camera_site_tenant_mismatch_fails(self, client: AsyncClient):
        async with client:
            user = await create_test_user("cam3@test.com", "pass")
            tenant, _ = await create_test_tenant_and_membership(user.id, Role.INSTALLER)
            
            # Site belongs to some other tenant
            other_tenant_id = uuid.uuid4()
            site = await create_test_site(other_tenant_id)
            
            headers = await get_auth_headers(user.id, tenant.id)

            payload = {
                "tenant_id": str(tenant.id),
                "site_id": str(site.id), # Site does not belong to requested tenant
                "name": "Mismatch Camera",
                "host": "192.168.1.100",
                "stream_path": "/cam",
            }
            resp = await client.post("/api/v1/cameras", json=payload, headers=headers)

        assert resp.status_code == 400


# ===========================================================================
# ACTION ENDPOINTS
# ===========================================================================

class TestActionEndpoints:
    @pytest.mark.asyncio
    async def test_camera_health_check(self, client: AsyncClient):
        async with client:
            user = await create_test_user("action1@test.com", "pass")
            tenant, _ = await create_test_tenant_and_membership(user.id, Role.OPERATOR)
            site = await create_test_site(tenant.id)
            headers = await get_auth_headers(user.id, tenant.id)

            # Create camera
            resp = await client.post("/api/v1/cameras", json={
                "tenant_id": str(tenant.id),
                "site_id": str(site.id),
                "name": "Health Cam",
                "host": "1.2.3.4",
                "stream_path": "/"
            }, headers=headers)
            cam_id = resp.json()["id"]

            # Check health
            resp = await client.get(f"/api/v1/cameras/{cam_id}/health", headers=headers)
        
        assert resp.status_code == 200
        assert resp.json()["status"] == "offline"

    @pytest.mark.asyncio
    async def test_camera_preview_token(self, client: AsyncClient):
        async with client:
            user = await create_test_user("action2@test.com", "pass")
            tenant, _ = await create_test_tenant_and_membership(user.id, Role.OPERATOR)
            site = await create_test_site(tenant.id)
            headers = await get_auth_headers(user.id, tenant.id)

            resp = await client.post("/api/v1/cameras", json={
                "tenant_id": str(tenant.id),
                "site_id": str(site.id),
                "name": "Preview Cam",
                "host": "1.2.3.4",
                "stream_path": "/"
            }, headers=headers)
            cam_id = resp.json()["id"]

            # Generate token
            resp = await client.post(f"/api/v1/cameras/{cam_id}/preview-token", headers=headers)
        
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data
        assert "preview_url" in data
