"""
AI Surveillance System - Site Repository

Data access layer for the sites table.
All database queries for sites live here.
"""

import uuid
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.site import Site


class SiteRepository:
    """Repository that encapsulates site database operations."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, site: Site) -> Site:
        """Insert a new site and return it."""
        self.db.add(site)
        await self.db.flush()
        await self.db.refresh(site)
        return site

    async def get_by_id(self, site_id: uuid.UUID) -> Optional[Site]:
        """Return a site by its UUID, or None."""
        stmt = select(Site).where(Site.id == site_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_name_and_tenant(
        self,
        name: str,
        tenant_id: uuid.UUID,
    ) -> Optional[Site]:
        """Return a site by name within a tenant, or None."""
        stmt = select(Site).where(
            Site.name == name,
            Site.tenant_id == tenant_id,
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_all(
        self,
        skip: int = 0,
        limit: int = 100,
        tenant_id: Optional[uuid.UUID] = None,
    ) -> tuple[list[Site], int]:
        """Return a paginated list of sites and the total count.

        Optionally filter by tenant_id.
        """
        # Base filter
        filters = []
        if tenant_id is not None:
            filters.append(Site.tenant_id == tenant_id)

        # Total count
        count_stmt = select(func.count()).select_from(Site)
        if filters:
            count_stmt = count_stmt.where(*filters)
        total_result = await self.db.execute(count_stmt)
        total = total_result.scalar_one()

        # Paginated results
        stmt = (
            select(Site)
            .order_by(Site.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        if filters:
            stmt = stmt.where(*filters)
        result = await self.db.execute(stmt)
        sites = list(result.scalars().all())

        return sites, total

    async def update(self, site: Site) -> Site:
        """Persist changes to an existing site."""
        await self.db.flush()
        await self.db.refresh(site)
        return site

    async def delete(self, site: Site) -> None:
        """Delete a site from the database."""
        await self.db.delete(site)
        await self.db.flush()
