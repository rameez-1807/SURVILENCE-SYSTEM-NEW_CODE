"""
Tests for the Site CRUD API.

Uses dependency overrides to inject a real async SQLite database
so the full Router -> Service -> Repository -> SQLAlchemy stack is
exercised without needing a running PostgreSQL instance.
"""

import uuid

import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def create_tenant(client: AsyncClient, name: str = "Test Tenant") -> dict:
    """Create a tenant and return the JSON response body."""
    resp = await client.post("/api/v1/tenants", json={"name": name})
    assert resp.status_code == 201, f"Tenant creation failed: {resp.text}"
    return resp.json()


async def create_site(
    client: AsyncClient,
    tenant_id: str,
    name: str = "Main Office",
    timezone: str = "UTC",
    address_json: dict | None = None,
) -> dict:
    """Create a site and return the raw response."""
    payload: dict = {
        "tenant_id": tenant_id,
        "name": name,
        "timezone": timezone,
    }
    if address_json is not None:
        payload["address_json"] = address_json
    resp = await client.post("/api/v1/sites", json=payload)
    return resp


# ===========================================================================
# POST /api/v1/sites
# ===========================================================================

class TestCreateSite:
    """Tests for the create site endpoint."""

    @pytest.mark.asyncio
    async def test_create_site_returns_201(self, client):
        async with client:
            tenant = await create_tenant(client)
            resp = await create_site(client, tenant["id"])
        assert resp.status_code == 201

    @pytest.mark.asyncio
    async def test_create_site_returns_correct_fields(self, client):
        async with client:
            tenant = await create_tenant(client)
            resp = await create_site(client, tenant["id"], name="HQ")
        data = resp.json()
        assert data["name"] == "HQ"
        assert data["tenant_id"] == tenant["id"]
        assert data["timezone"] == "UTC"
        assert "id" in data
        assert "created_at" in data
        assert "updated_at" in data

    @pytest.mark.asyncio
    async def test_create_site_with_address(self, client):
        async with client:
            tenant = await create_tenant(client)
            addr = {"street": "123 Main St", "city": "NYC", "country": "US"}
            resp = await create_site(
                client, tenant["id"], name="Addr Site", address_json=addr,
            )
        data = resp.json()
        assert resp.status_code == 201
        assert data["address_json"]["street"] == "123 Main St"
        assert data["address_json"]["city"] == "NYC"

    @pytest.mark.asyncio
    async def test_create_site_with_custom_timezone(self, client):
        async with client:
            tenant = await create_tenant(client)
            resp = await create_site(
                client, tenant["id"], name="TZ Site", timezone="America/New_York",
            )
        assert resp.status_code == 201
        assert resp.json()["timezone"] == "America/New_York"

    @pytest.mark.asyncio
    async def test_create_site_id_is_valid_uuid(self, client):
        async with client:
            tenant = await create_tenant(client)
            resp = await create_site(client, tenant["id"])
        uuid.UUID(resp.json()["id"])  # raises if invalid

    @pytest.mark.asyncio
    async def test_create_duplicate_name_same_tenant_returns_409(self, client):
        async with client:
            tenant = await create_tenant(client)
            await create_site(client, tenant["id"], name="Dup")
            resp = await create_site(client, tenant["id"], name="Dup")
        assert resp.status_code == 409

    @pytest.mark.asyncio
    async def test_create_same_name_different_tenants_succeeds(self, client):
        async with client:
            t1 = await create_tenant(client, name="Tenant A")
            t2 = await create_tenant(client, name="Tenant B")
            r1 = await create_site(client, t1["id"], name="Shared Name")
            r2 = await create_site(client, t2["id"], name="Shared Name")
        assert r1.status_code == 201
        assert r2.status_code == 201

    @pytest.mark.asyncio
    async def test_create_site_nonexistent_tenant_returns_404(self, client):
        async with client:
            fake_id = str(uuid.uuid4())
            resp = await create_site(client, fake_id, name="Orphan")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_create_site_empty_name_returns_422(self, client):
        async with client:
            tenant = await create_tenant(client)
            resp = await client.post(
                "/api/v1/sites",
                json={"tenant_id": tenant["id"], "name": ""},
            )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_create_site_missing_tenant_id_returns_422(self, client):
        async with client:
            resp = await client.post(
                "/api/v1/sites",
                json={"name": "No Tenant"},
            )
        assert resp.status_code == 422


# ===========================================================================
# GET /api/v1/sites
# ===========================================================================

class TestListSites:
    """Tests for the list sites endpoint."""

    @pytest.mark.asyncio
    async def test_list_empty_returns_200(self, client):
        async with client:
            resp = await client.get("/api/v1/sites")
        assert resp.status_code == 200
        data = resp.json()
        assert data["items"] == []
        assert data["total"] == 0

    @pytest.mark.asyncio
    async def test_list_returns_created_sites(self, client):
        async with client:
            tenant = await create_tenant(client)
            await create_site(client, tenant["id"], name="Site A")
            await create_site(client, tenant["id"], name="Site B")
            resp = await client.get("/api/v1/sites")
        data = resp.json()
        assert data["total"] == 2
        assert len(data["items"]) == 2

    @pytest.mark.asyncio
    async def test_list_filter_by_tenant_id(self, client):
        async with client:
            t1 = await create_tenant(client, name="T1")
            t2 = await create_tenant(client, name="T2")
            await create_site(client, t1["id"], name="T1 Site")
            await create_site(client, t2["id"], name="T2 Site")
            resp = await client.get(f"/api/v1/sites?tenant_id={t1['id']}")
        data = resp.json()
        assert data["total"] == 1
        assert data["items"][0]["tenant_id"] == t1["id"]

    @pytest.mark.asyncio
    async def test_list_pagination(self, client):
        async with client:
            tenant = await create_tenant(client)
            await create_site(client, tenant["id"], name="S1")
            await create_site(client, tenant["id"], name="S2")
            await create_site(client, tenant["id"], name="S3")
            resp = await client.get("/api/v1/sites?skip=1&limit=1")
        data = resp.json()
        assert data["total"] == 3
        assert len(data["items"]) == 1


# ===========================================================================
# GET /api/v1/sites/{site_id}
# ===========================================================================

class TestGetSite:
    """Tests for the get site by ID endpoint."""

    @pytest.mark.asyncio
    async def test_get_existing_site(self, client):
        async with client:
            tenant = await create_tenant(client)
            create_resp = await create_site(client, tenant["id"], name="Lookup")
            site_id = create_resp.json()["id"]
            resp = await client.get(f"/api/v1/sites/{site_id}")
        assert resp.status_code == 200
        assert resp.json()["name"] == "Lookup"

    @pytest.mark.asyncio
    async def test_get_nonexistent_site_returns_404(self, client):
        async with client:
            resp = await client.get(f"/api/v1/sites/{uuid.uuid4()}")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_get_invalid_uuid_returns_422(self, client):
        async with client:
            resp = await client.get("/api/v1/sites/not-a-uuid")
        assert resp.status_code == 422


# ===========================================================================
# PATCH /api/v1/sites/{site_id}
# ===========================================================================

class TestUpdateSite:
    """Tests for the update site endpoint."""

    @pytest.mark.asyncio
    async def test_update_name(self, client):
        async with client:
            tenant = await create_tenant(client)
            create_resp = await create_site(client, tenant["id"], name="Old")
            site_id = create_resp.json()["id"]
            resp = await client.patch(
                f"/api/v1/sites/{site_id}", json={"name": "New"},
            )
        assert resp.status_code == 200
        assert resp.json()["name"] == "New"

    @pytest.mark.asyncio
    async def test_update_timezone(self, client):
        async with client:
            tenant = await create_tenant(client)
            create_resp = await create_site(client, tenant["id"], name="TZ")
            site_id = create_resp.json()["id"]
            resp = await client.patch(
                f"/api/v1/sites/{site_id}", json={"timezone": "Asia/Tokyo"},
            )
        assert resp.status_code == 200
        assert resp.json()["timezone"] == "Asia/Tokyo"

    @pytest.mark.asyncio
    async def test_update_address(self, client):
        async with client:
            tenant = await create_tenant(client)
            create_resp = await create_site(client, tenant["id"], name="Addr")
            site_id = create_resp.json()["id"]
            resp = await client.patch(
                f"/api/v1/sites/{site_id}",
                json={"address_json": {"city": "London", "country": "UK"}},
            )
        assert resp.status_code == 200
        assert resp.json()["address_json"]["city"] == "London"

    @pytest.mark.asyncio
    async def test_update_nonexistent_returns_404(self, client):
        async with client:
            resp = await client.patch(
                f"/api/v1/sites/{uuid.uuid4()}", json={"name": "X"},
            )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_update_duplicate_name_same_tenant_returns_409(self, client):
        async with client:
            tenant = await create_tenant(client)
            await create_site(client, tenant["id"], name="Taken")
            create_resp = await create_site(client, tenant["id"], name="Other")
            site_id = create_resp.json()["id"]
            resp = await client.patch(
                f"/api/v1/sites/{site_id}", json={"name": "Taken"},
            )
        assert resp.status_code == 409

    @pytest.mark.asyncio
    async def test_update_empty_body_is_noop(self, client):
        async with client:
            tenant = await create_tenant(client)
            create_resp = await create_site(client, tenant["id"], name="Noop")
            site_id = create_resp.json()["id"]
            resp = await client.patch(f"/api/v1/sites/{site_id}", json={})
        assert resp.status_code == 200
        assert resp.json()["name"] == "Noop"


# ===========================================================================
# DELETE /api/v1/sites/{site_id}
# ===========================================================================

class TestDeleteSite:
    """Tests for the delete site endpoint."""

    @pytest.mark.asyncio
    async def test_delete_returns_204(self, client):
        async with client:
            tenant = await create_tenant(client)
            create_resp = await create_site(client, tenant["id"], name="Del")
            site_id = create_resp.json()["id"]
            resp = await client.delete(f"/api/v1/sites/{site_id}")
        assert resp.status_code == 204

    @pytest.mark.asyncio
    async def test_delete_removes_site(self, client):
        async with client:
            tenant = await create_tenant(client)
            create_resp = await create_site(client, tenant["id"], name="Gone")
            site_id = create_resp.json()["id"]
            await client.delete(f"/api/v1/sites/{site_id}")
            resp = await client.get(f"/api/v1/sites/{site_id}")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_nonexistent_returns_404(self, client):
        async with client:
            resp = await client.delete(f"/api/v1/sites/{uuid.uuid4()}")
        assert resp.status_code == 404


# ===========================================================================
# Relationship tests
# ===========================================================================

class TestSiteTenantRelationship:
    """Tests validating the Tenant -> Site FK relationship."""

    @pytest.mark.asyncio
    async def test_site_references_correct_tenant(self, client):
        async with client:
            tenant = await create_tenant(client, name="Parent")
            create_resp = await create_site(
                client, tenant["id"], name="Child",
            )
        assert create_resp.json()["tenant_id"] == tenant["id"]

    @pytest.mark.asyncio
    async def test_sites_are_scoped_to_tenant(self, client):
        """Filtering by tenant_id should only return that tenant's sites."""
        async with client:
            t1 = await create_tenant(client, name="Org A")
            t2 = await create_tenant(client, name="Org B")
            await create_site(client, t1["id"], name="A-Site")
            await create_site(client, t2["id"], name="B-Site")
            resp = await client.get(f"/api/v1/sites?tenant_id={t1['id']}")
        data = resp.json()
        assert data["total"] == 1
        assert all(s["tenant_id"] == t1["id"] for s in data["items"])
