"""
AI Surveillance System - Tenant Repository

Data access layer for the tenants table.
All database queries for tenants live here.
"""

import uuid
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tenant import Tenant


class TenantRepository:
    """Repository that encapsulates tenant database operations."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, tenant: Tenant) -> Tenant:
        """Insert a new tenant and return it."""
        self.db.add(tenant)
        await self.db.flush()
        await self.db.refresh(tenant)
        return tenant

    async def get_by_id(self, tenant_id: uuid.UUID) -> Optional[Tenant]:
        """Return a tenant by its UUID, or None."""
        stmt = select(Tenant).where(Tenant.id == tenant_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_name(self, name: str) -> Optional[Tenant]:
        """Return a tenant by its unique name, or None."""
        stmt = select(Tenant).where(Tenant.name == name)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_all(
        self,
        skip: int = 0,
        limit: int = 100,
    ) -> tuple[list[Tenant], int]:
        """Return a paginated list of tenants and the total count."""
        # Total count
        count_stmt = select(func.count()).select_from(Tenant)
        total_result = await self.db.execute(count_stmt)
        total = total_result.scalar_one()

        # Paginated results
        stmt = (
            select(Tenant)
            .order_by(Tenant.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        tenants = list(result.scalars().all())

        return tenants, total

    async def update(self, tenant: Tenant) -> Tenant:
        """Persist changes to an existing tenant."""
        await self.db.flush()
        await self.db.refresh(tenant)
        return tenant

    async def delete(self, tenant: Tenant) -> None:
        """Delete a tenant from the database."""
        await self.db.delete(tenant)
        await self.db.flush()
