"""
Tests for the Authentication and Authorization API.

Verifies JWT login, current user endpoint, password hashing, and Role-Based Access Control.
"""

import uuid
from datetime import timedelta

import pytest
from httpx import AsyncClient

from app.core.security import get_password_hash, create_access_token
from app.models.membership import Membership, Role
from app.models.tenant import Tenant
from app.models.user import User


from tests.conftest import create_test_user, create_test_tenant_and_membership




# ===========================================================================
# POST /api/v1/auth/token
# ===========================================================================

class TestLogin:
    @pytest.mark.asyncio
    async def test_valid_login_returns_token(self, client: AsyncClient):
        async with client:
            user = await create_test_user("valid@test.com", "password123")
            resp = await client.post(
                "/api/v1/auth/token",
                data={"username": "valid@test.com", "password": "password123"},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    @pytest.mark.asyncio
    async def test_invalid_login_wrong_password(self, client: AsyncClient):
        async with client:
            user = await create_test_user("wrongpass@test.com", "correct")
            resp = await client.post(
                "/api/v1/auth/token",
                data={"username": "wrongpass@test.com", "password": "wrong"},
            )
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_invalid_login_unknown_user(self, client: AsyncClient):
        async with client:
            resp = await client.post(
                "/api/v1/auth/token",
                data={"username": "ghost@test.com", "password": "password"},
            )
        assert resp.status_code == 401


# ===========================================================================
# GET /api/v1/me
# ===========================================================================

class TestCurrentUser:
    @pytest.mark.asyncio
    async def test_get_current_user_with_valid_token(self, client: AsyncClient):
        async with client:
            user = await create_test_user("me@test.com", "pass")
            token = create_access_token(subject=str(user.id))
            
            resp = await client.get(
                "/api/v1/me",
                headers={"Authorization": f"Bearer {token}"}
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == "me@test.com"
        assert "hashed_password" not in data  # Ensure password is not exposed

    @pytest.mark.asyncio
    async def test_get_current_user_missing_token(self, client: AsyncClient):
        async with client:
            resp = await client.get("/api/v1/me")
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_get_current_user_expired_token(self, client: AsyncClient):
        async with client:
            user = await create_test_user("expired@test.com", "pass")
            token = create_access_token(subject=str(user.id), expires_delta=timedelta(seconds=-1))
            
            resp = await client.get(
                "/api/v1/me",
                headers={"Authorization": f"Bearer {token}"}
            )
        assert resp.status_code == 401


# ===========================================================================
# Role-Based Access Control (RBAC)
# ===========================================================================

from fastapi import Depends
from app.main import app
from app.api.deps import RoleChecker

# We add a dummy endpoint to test the RoleChecker dependency
@app.get("/api/v1/test-rbac", dependencies=[Depends(RoleChecker([Role.SUPERVISOR]))])
async def test_rbac_endpoint():
    return {"status": "authorized"}


class TestRBAC:
    @pytest.mark.asyncio
    async def test_rbac_authorized(self, client: AsyncClient):
        async with client:
            user = await create_test_user("supervisor@test.com", "pass")
            tenant, _ = await create_test_tenant_and_membership(user.id, Role.SUPERVISOR)
            token = create_access_token(subject=str(user.id))
            
            resp = await client.get(
                "/api/v1/test-rbac",
                headers={
                    "Authorization": f"Bearer {token}",
                    "X-Tenant-ID": str(tenant.id)
                }
            )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_rbac_unauthorized_wrong_role(self, client: AsyncClient):
        async with client:
            user = await create_test_user("operator@test.com", "pass")
            tenant, _ = await create_test_tenant_and_membership(user.id, Role.OPERATOR)
            token = create_access_token(subject=str(user.id))
            
            resp = await client.get(
                "/api/v1/test-rbac",
                headers={
                    "Authorization": f"Bearer {token}",
                    "X-Tenant-ID": str(tenant.id)
                }
            )
        assert resp.status_code == 403

    @pytest.mark.asyncio
    async def test_rbac_unauthorized_missing_tenant_header(self, client: AsyncClient):
        async with client:
            user = await create_test_user("supervisor2@test.com", "pass")
            await create_test_tenant_and_membership(user.id, Role.SUPERVISOR)
            token = create_access_token(subject=str(user.id))
            
            resp = await client.get(
                "/api/v1/test-rbac",
                headers={"Authorization": f"Bearer {token}"}
            )
        # Without X-Tenant-ID, it shouldn't know which tenant we are trying to access
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_rbac_platform_admin_bypasses_tenant_check(self, client: AsyncClient):
        async with client:
            user = await create_test_user("platform@test.com", "pass")
            # Platform admin doesn't need a specific tenant
            await create_test_tenant_and_membership(user.id, Role.PLATFORM_ADMIN)
            token = create_access_token(subject=str(user.id))
            
            resp = await client.get(
                "/api/v1/test-rbac",
                headers={"Authorization": f"Bearer {token}"}
                # Note: No X-Tenant-ID header provided
            )
        assert resp.status_code == 200
