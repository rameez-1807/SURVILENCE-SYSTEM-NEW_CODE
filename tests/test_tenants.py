"""
Tests for the Tenant CRUD API.

Uses dependency overrides to inject a real async SQLite database
so the full Router → Service → Repository → SQLAlchemy stack is
exercised without needing a running PostgreSQL instance.
"""

import uuid

import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

async def create_tenant(client: AsyncClient, name: str = "Acme Corp", status: str = "active"):
    """Helper to POST a tenant and return the response."""
    return await client.post(
        "/api/v1/tenants",
        json={"name": name, "status": status},
    )


# ===========================================================================
# POST /api/v1/tenants
# ===========================================================================

class TestCreateTenant:
    """Tests for the create tenant endpoint."""

    @pytest.mark.asyncio
    async def test_create_tenant_returns_201(self, client):
        async with client:
            resp = await create_tenant(client)
        assert resp.status_code == 201

    @pytest.mark.asyncio
    async def test_create_tenant_returns_correct_fields(self, client):
        async with client:
            resp = await create_tenant(client, name="Test Org")
        data = resp.json()
        assert data["name"] == "Test Org"
        assert data["status"] == "active"
        assert "id" in data
        assert "created_at" in data
        assert "updated_at" in data

    @pytest.mark.asyncio
    async def test_create_tenant_id_is_valid_uuid(self, client):
        async with client:
            resp = await create_tenant(client)
        data = resp.json()
        uuid.UUID(data["id"])  # raises if invalid

    @pytest.mark.asyncio
    async def test_create_duplicate_name_returns_409(self, client):
        async with client:
            await create_tenant(client, name="Duplicate")
            resp = await create_tenant(client, name="Duplicate")
        assert resp.status_code == 409

    @pytest.mark.asyncio
    async def test_create_tenant_empty_name_returns_422(self, client):
        async with client:
            resp = await client.post(
                "/api/v1/tenants",
                json={"name": "", "status": "active"},
            )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_create_tenant_invalid_status_returns_422(self, client):
        async with client:
            resp = await client.post(
                "/api/v1/tenants",
                json={"name": "ValidName", "status": "bogus"},
            )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_create_tenant_default_status_is_active(self, client):
        async with client:
            resp = await client.post(
                "/api/v1/tenants",
                json={"name": "Defaults"},
            )
        assert resp.status_code == 201
        assert resp.json()["status"] == "active"


# ===========================================================================
# GET /api/v1/tenants
# ===========================================================================

class TestListTenants:
    """Tests for the list tenants endpoint."""

    @pytest.mark.asyncio
    async def test_list_empty_returns_200(self, client):
        async with client:
            resp = await client.get("/api/v1/tenants")
        assert resp.status_code == 200
        data = resp.json()
        assert data["items"] == []
        assert data["total"] == 0

    @pytest.mark.asyncio
    async def test_list_returns_created_tenants(self, client):
        async with client:
            await create_tenant(client, name="Alpha")
            await create_tenant(client, name="Beta")
            resp = await client.get("/api/v1/tenants")
        data = resp.json()
        assert data["total"] == 2
        assert len(data["items"]) == 2

    @pytest.mark.asyncio
    async def test_list_pagination_skip(self, client):
        async with client:
            await create_tenant(client, name="A")
            await create_tenant(client, name="B")
            await create_tenant(client, name="C")
            resp = await client.get("/api/v1/tenants?skip=1&limit=2")
        data = resp.json()
        assert data["total"] == 3
        assert len(data["items"]) == 2

    @pytest.mark.asyncio
    async def test_list_pagination_limit(self, client):
        async with client:
            await create_tenant(client, name="X")
            await create_tenant(client, name="Y")
            resp = await client.get("/api/v1/tenants?limit=1")
        data = resp.json()
        assert len(data["items"]) == 1
        assert data["total"] == 2


# ===========================================================================
# GET /api/v1/tenants/{tenant_id}
# ===========================================================================

class TestGetTenant:
    """Tests for the get tenant by ID endpoint."""

    @pytest.mark.asyncio
    async def test_get_existing_tenant(self, client):
        async with client:
            create_resp = await create_tenant(client, name="Lookup")
            tenant_id = create_resp.json()["id"]
            resp = await client.get(f"/api/v1/tenants/{tenant_id}")
        assert resp.status_code == 200
        assert resp.json()["name"] == "Lookup"

    @pytest.mark.asyncio
    async def test_get_nonexistent_tenant_returns_404(self, client):
        random_id = str(uuid.uuid4())
        async with client:
            resp = await client.get(f"/api/v1/tenants/{random_id}")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_get_invalid_uuid_returns_422(self, client):
        async with client:
            resp = await client.get("/api/v1/tenants/not-a-uuid")
        assert resp.status_code == 422


# ===========================================================================
# PATCH /api/v1/tenants/{tenant_id}
# ===========================================================================

class TestUpdateTenant:
    """Tests for the update tenant endpoint."""

    @pytest.mark.asyncio
    async def test_update_name(self, client):
        async with client:
            create_resp = await create_tenant(client, name="Old Name")
            tenant_id = create_resp.json()["id"]
            resp = await client.patch(
                f"/api/v1/tenants/{tenant_id}",
                json={"name": "New Name"},
            )
        assert resp.status_code == 200
        assert resp.json()["name"] == "New Name"

    @pytest.mark.asyncio
    async def test_update_status(self, client):
        async with client:
            create_resp = await create_tenant(client, name="StatusTest")
            tenant_id = create_resp.json()["id"]
            resp = await client.patch(
                f"/api/v1/tenants/{tenant_id}",
                json={"status": "suspended"},
            )
        assert resp.status_code == 200
        assert resp.json()["status"] == "suspended"

    @pytest.mark.asyncio
    async def test_update_nonexistent_returns_404(self, client):
        random_id = str(uuid.uuid4())
        async with client:
            resp = await client.patch(
                f"/api/v1/tenants/{random_id}",
                json={"name": "Whatever"},
            )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_update_duplicate_name_returns_409(self, client):
        async with client:
            await create_tenant(client, name="Taken")
            create_resp = await create_tenant(client, name="Other")
            tenant_id = create_resp.json()["id"]
            resp = await client.patch(
                f"/api/v1/tenants/{tenant_id}",
                json={"name": "Taken"},
            )
        assert resp.status_code == 409

    @pytest.mark.asyncio
    async def test_update_empty_body_is_noop(self, client):
        async with client:
            create_resp = await create_tenant(client, name="Noop")
            tenant_id = create_resp.json()["id"]
            resp = await client.patch(
                f"/api/v1/tenants/{tenant_id}",
                json={},
            )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Noop"


# ===========================================================================
# DELETE /api/v1/tenants/{tenant_id}
# ===========================================================================

class TestDeleteTenant:
    """Tests for the delete tenant endpoint."""

    @pytest.mark.asyncio
    async def test_delete_returns_204(self, client):
        async with client:
            create_resp = await create_tenant(client, name="ToDelete")
            tenant_id = create_resp.json()["id"]
            resp = await client.delete(f"/api/v1/tenants/{tenant_id}")
        assert resp.status_code == 204

    @pytest.mark.asyncio
    async def test_delete_removes_tenant(self, client):
        async with client:
            create_resp = await create_tenant(client, name="Gone")
            tenant_id = create_resp.json()["id"]
            await client.delete(f"/api/v1/tenants/{tenant_id}")
            resp = await client.get(f"/api/v1/tenants/{tenant_id}")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_nonexistent_returns_404(self, client):
        random_id = str(uuid.uuid4())
        async with client:
            resp = await client.delete(f"/api/v1/tenants/{random_id}")
        assert resp.status_code == 404
