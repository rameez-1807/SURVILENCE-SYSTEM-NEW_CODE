"""
AI Surveillance System - Site API Router

CRUD endpoints for site management.
"""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.repositories.site import SiteRepository
from app.repositories.tenant import TenantRepository
from app.schemas.site import (
    SiteCreate,
    SiteListResponse,
    SiteResponse,
    SiteUpdate,
)
from app.services.site import SiteService

router = APIRouter(prefix="/sites", tags=["Sites"])


def _get_service(db: AsyncSession = Depends(get_db)) -> SiteService:
    """Build the service with its repository dependencies."""
    return SiteService(
        repo=SiteRepository(db),
        tenant_repo=TenantRepository(db),
    )


@router.post(
    "",
    response_model=SiteResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Site",
    description="Register a new site under a tenant. Name must be unique within the tenant.",
)
async def create_site(
    data: SiteCreate,
    service: SiteService = Depends(_get_service),
) -> SiteResponse:
    site = await service.create_site(data)
    return SiteResponse.model_validate(site)


@router.get(
    "",
    response_model=SiteListResponse,
    summary="List Sites",
    description="Retrieve a paginated list of sites. Optionally filter by tenant_id.",
)
async def list_sites(
    skip: int = Query(0, ge=0, description="Number of records to skip."),
    limit: int = Query(100, ge=1, le=500, description="Max records to return."),
    tenant_id: Optional[uuid.UUID] = Query(
        None, description="Filter by tenant UUID."
    ),
    service: SiteService = Depends(_get_service),
) -> SiteListResponse:
    sites, total = await service.list_sites(
        skip=skip, limit=limit, tenant_id=tenant_id
    )
    return SiteListResponse(
        items=[SiteResponse.model_validate(s) for s in sites],
        total=total,
    )


@router.get(
    "/{site_id}",
    response_model=SiteResponse,
    summary="Get Site",
    description="Retrieve a single site by its UUID.",
)
async def get_site(
    site_id: uuid.UUID,
    service: SiteService = Depends(_get_service),
) -> SiteResponse:
    site = await service.get_site(site_id)
    return SiteResponse.model_validate(site)


@router.patch(
    "/{site_id}",
    response_model=SiteResponse,
    summary="Update Site",
    description="Partially update a site's name, timezone, or address.",
)
async def update_site(
    site_id: uuid.UUID,
    data: SiteUpdate,
    service: SiteService = Depends(_get_service),
) -> SiteResponse:
    site = await service.update_site(site_id, data)
    return SiteResponse.model_validate(site)


@router.delete(
    "/{site_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Site",
    description="Permanently delete a site by its UUID.",
)
async def delete_site(
    site_id: uuid.UUID,
    service: SiteService = Depends(_get_service),
) -> None:
    await service.delete_site(site_id)
