"""
AI Surveillance System - Site Service

Business logic layer for site operations.
Validates tenant existence and site-name uniqueness within a tenant.
"""

import json
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status

from app.models.site import Site
from app.repositories.site import SiteRepository
from app.repositories.tenant import TenantRepository
from app.schemas.site import SiteCreate, SiteUpdate


class SiteService:
    """Service that orchestrates site business logic."""

    def __init__(
        self,
        repo: SiteRepository,
        tenant_repo: TenantRepository,
    ) -> None:
        self.repo = repo
        self.tenant_repo = tenant_repo

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    async def _ensure_tenant_exists(self, tenant_id: uuid.UUID) -> None:
        """Raise 404 if the referenced tenant does not exist."""
        tenant = await self.tenant_repo.get_by_id(tenant_id)
        if tenant is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Tenant with id '{tenant_id}' not found.",
            )

    # ------------------------------------------------------------------
    # CRUD
    # ------------------------------------------------------------------

    async def create_site(self, data: SiteCreate) -> Site:
        """Create a new site after validating tenant and uniqueness."""
        await self._ensure_tenant_exists(data.tenant_id)

        existing = await self.repo.get_by_name_and_tenant(
            data.name, data.tenant_id
        )
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Site with name '{data.name}' already exists "
                    f"for tenant '{data.tenant_id}'."
                ),
            )

        address_str = (
            data.address_json.model_dump_json() if data.address_json else None
        )

        site = Site(
            tenant_id=data.tenant_id,
            name=data.name,
            timezone=data.timezone,
            address_json=address_str,
        )
        return await self.repo.create(site)

    async def get_site(self, site_id: uuid.UUID) -> Site:
        """Retrieve a single site or raise 404."""
        site = await self.repo.get_by_id(site_id)
        if site is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Site with id '{site_id}' not found.",
            )
        return site

    async def list_sites(
        self,
        skip: int = 0,
        limit: int = 100,
        tenant_id: Optional[uuid.UUID] = None,
    ) -> tuple[list[Site], int]:
        """Return a paginated list of sites, optionally filtered by tenant."""
        return await self.repo.get_all(
            skip=skip, limit=limit, tenant_id=tenant_id
        )

    async def update_site(
        self,
        site_id: uuid.UUID,
        data: SiteUpdate,
    ) -> Site:
        """Partially update a site."""
        site = await self.get_site(site_id)

        update_data = data.model_dump(exclude_unset=True)

        if "name" in update_data:
            existing = await self.repo.get_by_name_and_tenant(
                update_data["name"], site.tenant_id
            )
            if existing is not None and existing.id != site_id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=(
                        f"Site with name '{update_data['name']}' already "
                        f"exists for tenant '{site.tenant_id}'."
                    ),
                )
            site.name = update_data["name"]

        if "timezone" in update_data:
            site.timezone = update_data["timezone"]

        if "address_json" in update_data:
            addr = update_data["address_json"]
            if addr is not None:
                site.address_json = json.dumps(
                    addr if isinstance(addr, dict) else addr.model_dump()
                )
            else:
                site.address_json = None

        site.updated_at = datetime.now(timezone.utc)

        return await self.repo.update(site)

    async def delete_site(self, site_id: uuid.UUID) -> None:
        """Delete a site or raise 404."""
        site = await self.get_site(site_id)
        await self.repo.delete(site)
