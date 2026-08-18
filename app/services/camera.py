"""
AI Surveillance System - Camera Service

Business logic for cameras, including robust authorization, tenant isolation, and site ownership.
"""

import uuid
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.camera import Camera
from app.repositories.camera import CameraRepository
from app.repositories.site import SiteRepository
from app.schemas.camera import CameraCreate, CameraUpdate
from app.core.camera.manager import CameraManager


class CameraService:
    """Service handling camera business logic and security."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = CameraRepository(db)
        self.site_repo = SiteRepository(db)

    async def get_by_id(self, camera_id: uuid.UUID, user_tenant_id: uuid.UUID | None = None) -> Camera:
        """
        Get a camera by ID. 
        If user_tenant_id is provided, ensures the camera belongs to that tenant (isolation).
        """
        camera = await self.repo.get_by_id(camera_id)
        if not camera:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Camera not found",
            )
        
        # Enforce tenant isolation for non-platform-admins
        if user_tenant_id and camera.tenant_id != user_tenant_id:
             raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Camera belongs to a different tenant",
            )

        return camera

    async def list_cameras(
        self,
        tenant_id: uuid.UUID | None = None,
        site_id: uuid.UUID | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> tuple[int, list[Camera]]:
        """List cameras for a tenant or site."""
        # Note: tenant_id comes from X-Tenant-ID header and RBAC checker
        return await self.repo.list_cameras(
            tenant_id=tenant_id, site_id=site_id, skip=skip, limit=limit
        )

    async def create(self, obj_in: CameraCreate, user_tenant_id: uuid.UUID | None = None) -> Camera:
        """Create a new camera, verifying site belongs to tenant."""
        
        # Enforce tenant isolation
        if user_tenant_id and obj_in.tenant_id != user_tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot create camera for a different tenant",
            )

        # Ensure Site belongs to the requested Tenant
        site = await self.site_repo.get_by_id(obj_in.site_id)
        if not site:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Site not found",
            )
        if site.tenant_id != obj_in.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Site does not belong to the specified Tenant",
            )

        # Check for name uniqueness within the site
        existing = await self.repo.get_by_name_and_site(obj_in.name, obj_in.site_id)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Camera with this name already exists in this site",
            )

        return await self.repo.create(obj_in)

    async def update(
        self, camera_id: uuid.UUID, obj_in: CameraUpdate, user_tenant_id: uuid.UUID | None = None
    ) -> Camera:
        """Update a camera."""
        camera = await self.get_by_id(camera_id, user_tenant_id)

        if obj_in.name and obj_in.name != camera.name:
            existing = await self.repo.get_by_name_and_site(obj_in.name, camera.site_id)
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Camera with this name already exists in this site",
                )

        return await self.repo.update(camera, obj_in)

    async def delete(self, camera_id: uuid.UUID, user_tenant_id: uuid.UUID | None = None) -> None:
        """Delete a camera."""
        camera = await self.get_by_id(camera_id, user_tenant_id)
        await self.repo.delete(camera.id)
        
        # Stop the camera capture stream if it's running
        CameraManager().stop_stream(camera.id)
