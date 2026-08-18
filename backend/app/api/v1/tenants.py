"""
AI Surveillance System - Tenant API Router

CRUD endpoints for tenant management.
"""

import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.repositories.tenant import TenantRepository
from app.schemas.tenant import (
    TenantCreate,
    TenantListResponse,
    TenantResponse,
    TenantUpdate,
)
from app.services.tenant import TenantService

router = APIRouter(prefix="/tenants", tags=["Tenants"])


def _get_service(db: AsyncSession = Depends(get_db)) -> TenantService:
    """Build the service with its repository dependency."""
    return TenantService(repo=TenantRepository(db))


@router.post(
    "",
    response_model=TenantResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Tenant",
    description="Register a new tenant. Name must be unique.",
)
async def create_tenant(
    data: TenantCreate,
    service: TenantService = Depends(_get_service),
) -> TenantResponse:
    tenant = await service.create_tenant(data)
    return TenantResponse.model_validate(tenant)


@router.get(
    "",
    response_model=TenantListResponse,
    summary="List Tenants",
    description="Retrieve a paginated list of all tenants.",
)
async def list_tenants(
    skip: int = Query(0, ge=0, description="Number of records to skip."),
    limit: int = Query(100, ge=1, le=500, description="Max records to return."),
    service: TenantService = Depends(_get_service),
) -> TenantListResponse:
    tenants, total = await service.list_tenants(skip=skip, limit=limit)
    return TenantListResponse(
        items=[TenantResponse.model_validate(t) for t in tenants],
        total=total,
    )


@router.get(
    "/{tenant_id}",
    response_model=TenantResponse,
    summary="Get Tenant",
    description="Retrieve a single tenant by its UUID.",
)
async def get_tenant(
    tenant_id: uuid.UUID,
    service: TenantService = Depends(_get_service),
) -> TenantResponse:
    tenant = await service.get_tenant(tenant_id)
    return TenantResponse.model_validate(tenant)


@router.patch(
    "/{tenant_id}",
    response_model=TenantResponse,
    summary="Update Tenant",
    description="Partially update a tenant's name or status.",
)
async def update_tenant(
    tenant_id: uuid.UUID,
    data: TenantUpdate,
    service: TenantService = Depends(_get_service),
) -> TenantResponse:
    tenant = await service.update_tenant(tenant_id, data)
    return TenantResponse.model_validate(tenant)


@router.delete(
    "/{tenant_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Tenant",
    description="Permanently delete a tenant by its UUID.",
)
async def delete_tenant(
    tenant_id: uuid.UUID,
    service: TenantService = Depends(_get_service),
) -> None:
    await service.delete_tenant(tenant_id)
