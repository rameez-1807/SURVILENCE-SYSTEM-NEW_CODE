"""
AI Surveillance System - Detection Zone Repository
"""

import uuid
from typing import List, Optional
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.detection_zone import DetectionZone
from app.schemas.detection_zone import DetectionZoneCreate, DetectionZoneUpdate


class DetectionZoneRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, zone_id: uuid.UUID) -> Optional[DetectionZone]:
        stmt = select(DetectionZone).where(DetectionZone.id == zone_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_camera(self, camera_id: uuid.UUID) -> List[DetectionZone]:
        stmt = select(DetectionZone).where(
            DetectionZone.camera_id == camera_id,
            DetectionZone.enabled == True
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_by_tenant(self, tenant_id: uuid.UUID, skip: int = 0, limit: int = 100) -> List[DetectionZone]:
        stmt = (
            select(DetectionZone)
            .where(DetectionZone.tenant_id == tenant_id)
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create(self, obj_in: DetectionZoneCreate) -> DetectionZone:
        db_obj = DetectionZone(**obj_in.model_dump())
        self.db.add(db_obj)
        await self.db.flush()
        await self.db.refresh(db_obj)
        return db_obj

    async def update(self, db_obj: DetectionZone, obj_in: DetectionZoneUpdate) -> DetectionZone:
        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        await self.db.flush()
        await self.db.refresh(db_obj)
        return db_obj

    async def delete(self, zone_id: uuid.UUID) -> bool:
        stmt = delete(DetectionZone).where(DetectionZone.id == zone_id)
        res = await self.db.execute(stmt)
        return res.rowcount > 0
