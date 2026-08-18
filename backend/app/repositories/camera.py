"""
AI Surveillance System - Camera Repository

Data access operations for cameras.
"""

import uuid
from typing import Optional

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.camera import Camera
from app.schemas.camera import CameraCreate, CameraUpdate


class CameraRepository:
    """Repository that encapsulates camera database operations."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(self, camera_id: uuid.UUID) -> Optional[Camera]:
        """Get a camera by its ID."""
        stmt = select(Camera).where(Camera.id == camera_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_name_and_site(self, name: str, site_id: uuid.UUID) -> Optional[Camera]:
        """Get a camera by name within a site."""
        stmt = select(Camera).where(Camera.name == name, Camera.site_id == site_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_cameras(
        self,
        tenant_id: Optional[uuid.UUID] = None,
        site_id: Optional[uuid.UUID] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> tuple[int, list[Camera]]:
        """List cameras, optionally filtered by tenant or site."""
        stmt = select(Camera)
        count_stmt = select(func.count()).select_from(Camera)

        if tenant_id:
            stmt = stmt.where(Camera.tenant_id == tenant_id)
            count_stmt = count_stmt.where(Camera.tenant_id == tenant_id)
            
        if site_id:
            stmt = stmt.where(Camera.site_id == site_id)
            count_stmt = count_stmt.where(Camera.site_id == site_id)

        # Get total count
        count_result = await self.db.execute(count_stmt)
        total = count_result.scalar_one()

        # Get paginated items
        stmt = stmt.offset(skip).limit(limit).order_by(Camera.created_at.desc())
        result = await self.db.execute(stmt)
        items = list(result.scalars().all())

        return total, items

    async def create(self, obj_in: CameraCreate) -> Camera:
        """Create a new camera."""
        db_obj = Camera(**obj_in.model_dump())
        self.db.add(db_obj)
        await self.db.flush()
        await self.db.refresh(db_obj)
        return db_obj

    async def update(self, db_obj: Camera, obj_in: CameraUpdate) -> Camera:
        """Update a camera."""
        update_data = obj_in.model_dump(exclude_unset=True)
        if update_data:
            stmt = (
                update(Camera)
                .where(Camera.id == db_obj.id)
                .values(**update_data)
            )
            await self.db.execute(stmt)
            await self.db.refresh(db_obj)
        return db_obj

    async def delete(self, camera_id: uuid.UUID) -> bool:
        """Delete a camera."""
        stmt = delete(Camera).where(Camera.id == camera_id)
        result = await self.db.execute(stmt)
        return result.rowcount > 0
