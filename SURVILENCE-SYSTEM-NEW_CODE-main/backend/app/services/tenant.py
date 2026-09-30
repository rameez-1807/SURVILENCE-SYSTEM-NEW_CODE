"""
AI Surveillance System - Tenant Service

Business logic layer for tenant operations.
Sits between the API router and the repository.
"""

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status

from app.models.tenant import Tenant, TenantStatus as ModelTenantStatus
from app.repositories.tenant import TenantRepository
from app.schemas.tenant import TenantCreate, TenantUpdate


class TenantService:
    """Service that orchestrates tenant business logic."""

    def __init__(self, repo: TenantRepository) -> None:
        self.repo = repo

    async def create_tenant(self, data: TenantCreate) -> Tenant:
        """Create a new tenant after validating uniqueness."""
        existing = await self.repo.get_by_name(data.name)
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Tenant with name '{data.name}' already exists.",
            )

        tenant = Tenant(
            name=data.name,
            status=ModelTenantStatus(data.status.value),
        )
        return await self.repo.create(tenant)

    async def get_tenant(self, tenant_id: uuid.UUID) -> Tenant:
        """Retrieve a single tenant or raise 404."""
        tenant = await self.repo.get_by_id(tenant_id)
        if tenant is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Tenant with id '{tenant_id}' not found.",
            )
        return tenant

    async def list_tenants(
        self,
        skip: int = 0,
        limit: int = 100,
    ) -> tuple[list[Tenant], int]:
        """Return a paginated list of tenants."""
        return await self.repo.get_all(skip=skip, limit=limit)

    async def update_tenant(
        self,
        tenant_id: uuid.UUID,
        data: TenantUpdate,
    ) -> Tenant:
        """Partially update a tenant."""
        tenant = await self.get_tenant(tenant_id)

        update_data = data.model_dump(exclude_unset=True)

        if "name" in update_data:
            existing = await self.repo.get_by_name(update_data["name"])
            if existing is not None and existing.id != tenant_id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Tenant with name '{update_data['name']}' already exists.",
                )

        for field, value in update_data.items():
            if field == "status":
                setattr(tenant, field, ModelTenantStatus(value.value))
            else:
                setattr(tenant, field, value)

        tenant.updated_at = datetime.now(timezone.utc)

        return await self.repo.update(tenant)

    async def delete_tenant(self, tenant_id: uuid.UUID) -> None:
        """Delete a tenant or raise 404."""
        tenant = await self.get_tenant(tenant_id)
        await self.repo.delete(tenant)
