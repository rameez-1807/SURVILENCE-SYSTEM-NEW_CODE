"""
AI Surveillance System - Cameras API Router

Endpoints for Camera management and actions.
"""

import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Header, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, RoleChecker, get_db
from app.models.membership import Role
from app.schemas.camera import (
    CameraCreate,
    CameraHealthResponse,
    CameraListResponse,
    CameraResponse,
    CameraUpdate,
    PreviewTokenResponse,
)
from app.services.camera import CameraService
from app.core.camera.manager import CameraManager
from app.core.camera.state import CameraState

router = APIRouter(prefix="/cameras", tags=["Cameras"])

# Require at least one of these roles for CRUD
WriteRoles = Depends(RoleChecker([Role.OPERATOR, Role.SUPERVISOR, Role.INSTALLER, Role.OEM_ADMIN]))

# To fetch a tenant_id header safely
TenantHeader = Annotated[uuid.UUID | None, Header(alias="X-Tenant-ID")]


def get_tenant_id_context(current_user: CurrentUser, x_tenant_id: TenantHeader = None) -> uuid.UUID | None:
    """Helper to determine the tenant context, respecting Platform Admins."""
    for membership in current_user.memberships:
        if membership.role == Role.PLATFORM_ADMIN:
            return None  # No tenant restriction
    return x_tenant_id


@router.post("", response_model=CameraResponse, status_code=status.HTTP_201_CREATED, dependencies=[WriteRoles])
async def create_camera(
    camera_in: CameraCreate,
    current_user: CurrentUser,
    x_tenant_id: TenantHeader = None,
    db: AsyncSession = Depends(get_db),
) -> CameraResponse:
    """Create a new camera."""
    service = CameraService(db)
    user_tenant_id = get_tenant_id_context(current_user, x_tenant_id)
    return await service.create(camera_in, user_tenant_id)


@router.get("", response_model=CameraListResponse, dependencies=[WriteRoles])
async def list_cameras(
    current_user: CurrentUser,
    x_tenant_id: TenantHeader = None,
    site_id: Optional[uuid.UUID] = Query(None, description="Filter by site ID"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
) -> CameraListResponse:
    """List cameras with pagination and optional site filter."""
    service = CameraService(db)
    user_tenant_id = get_tenant_id_context(current_user, x_tenant_id)
    
    total, items = await service.list_cameras(
        tenant_id=user_tenant_id, site_id=site_id, skip=skip, limit=limit
    )
    
    return CameraListResponse(total=total, items=items)  # type: ignore


@router.get("/{camera_id}", response_model=CameraResponse, dependencies=[WriteRoles])
async def get_camera(
    camera_id: uuid.UUID,
    current_user: CurrentUser,
    x_tenant_id: TenantHeader = None,
    db: AsyncSession = Depends(get_db),
) -> CameraResponse:
    """Get a specific camera by ID."""
    service = CameraService(db)
    user_tenant_id = get_tenant_id_context(current_user, x_tenant_id)
    return await service.get_by_id(camera_id, user_tenant_id)


@router.patch("/{camera_id}", response_model=CameraResponse, dependencies=[WriteRoles])
async def update_camera(
    camera_id: uuid.UUID,
    camera_in: CameraUpdate,
    current_user: CurrentUser,
    x_tenant_id: TenantHeader = None,
    db: AsyncSession = Depends(get_db),
) -> CameraResponse:
    """Update a specific camera."""
    service = CameraService(db)
    user_tenant_id = get_tenant_id_context(current_user, x_tenant_id)
    return await service.update(camera_id, camera_in, user_tenant_id)


@router.delete("/{camera_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[WriteRoles])
async def delete_camera(
    camera_id: uuid.UUID,
    current_user: CurrentUser,
    x_tenant_id: TenantHeader = None,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a specific camera."""
    service = CameraService(db)
    user_tenant_id = get_tenant_id_context(current_user, x_tenant_id)
    await service.delete(camera_id, user_tenant_id)


# ===========================================================================
# Action Endpoints
# ===========================================================================

@router.post("/{camera_id}/test", response_model=dict, dependencies=[WriteRoles])
async def test_camera_connection(
    camera_id: uuid.UUID,
    current_user: CurrentUser,
    x_tenant_id: TenantHeader = None,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Endpoint to start a camera stream test."""
    service = CameraService(db)
    user_tenant_id = get_tenant_id_context(current_user, x_tenant_id)
    camera = await service.get_by_id(camera_id, user_tenant_id)
    
    manager = CameraManager()
    manager.start_stream(camera.id, camera.stream_path, camera.stream_profile)
    
    return {"status": "success", "message": f"Connection requested for camera {camera.name}"}


@router.get("/{camera_id}/health", response_model=CameraHealthResponse, dependencies=[WriteRoles])
async def check_camera_health(
    camera_id: uuid.UUID,
    current_user: CurrentUser,
    x_tenant_id: TenantHeader = None,
    db: AsyncSession = Depends(get_db),
) -> CameraHealthResponse:
    """Endpoint to check camera health/latency."""
    service = CameraService(db)
    user_tenant_id = get_tenant_id_context(current_user, x_tenant_id)
    camera = await service.get_by_id(camera_id, user_tenant_id)
    
    manager = CameraManager()
    health = manager.get_health(camera.id)
    
    if health:
        latency = int(1000 / health.fps) if health.fps > 0 else 0
        return CameraHealthResponse(status=health.connection_state.value, latency_ms=latency)
    
    return CameraHealthResponse(status=CameraState.OFFLINE.value, latency_ms=0)


@router.post("/{camera_id}/preview-token", response_model=PreviewTokenResponse, dependencies=[WriteRoles])
async def generate_preview_token(
    camera_id: uuid.UUID,
    current_user: CurrentUser,
    x_tenant_id: TenantHeader = None,
    db: AsyncSession = Depends(get_db),
) -> PreviewTokenResponse:
    """Mock endpoint to generate a short-lived token for WebRTC/HLS streaming."""
    service = CameraService(db)
    user_tenant_id = get_tenant_id_context(current_user, x_tenant_id)
    camera = await service.get_by_id(camera_id, user_tenant_id)
    
    mock_token = f"tk_{uuid.uuid4().hex}"
    mock_url = f"wss://stream.ai-system.com/live/{camera.id}?token={mock_token}"
    
    return PreviewTokenResponse(
        preview_url=mock_url,
        token=mock_token,
        expires_in_seconds=3600
    )
