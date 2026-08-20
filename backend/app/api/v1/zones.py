"""
AI Surveillance System - Detection Zones API Router

CRUD endpoints for Camera Regions of Interest (ROI) and Security Zones.
"""

import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.models.detection_zone import DetectionZone
from app.repositories.detection_zone import DetectionZoneRepository
from app.schemas.detection_zone import (
    DetectionZoneCreate,
    DetectionZoneResponse,
    DetectionZoneUpdate,
)

router = APIRouter(prefix="/zones", tags=["Detection Zones"])


@router.post("", response_model=DetectionZoneResponse, status_code=status.HTTP_201_CREATED)
async def create_zone(
    zone_in: DetectionZoneCreate,
    db: AsyncSession = Depends(get_db)
) -> DetectionZoneResponse:
    """Create a new detection zone / ROI for a camera."""
    repo = DetectionZoneRepository(db)
    zone = await repo.create(zone_in)
    return DetectionZoneResponse.model_validate(zone)


@router.get("/camera/{camera_id}", response_model=List[DetectionZoneResponse])
async def list_camera_zones(
    camera_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
) -> List[DetectionZoneResponse]:
    """Get all enabled detection zones for a camera."""
    repo = DetectionZoneRepository(db)
    zones = await repo.get_by_camera(camera_id)
    return [DetectionZoneResponse.model_validate(z) for z in zones]


@router.get("", response_model=List[DetectionZoneResponse])
async def list_zones(
    tenant_id: uuid.UUID = Query(..., description="Tenant ID"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db)
) -> List[DetectionZoneResponse]:
    """List detection zones for a tenant."""
    repo = DetectionZoneRepository(db)
    zones = await repo.get_by_tenant(tenant_id, skip=skip, limit=limit)
    return [DetectionZoneResponse.model_validate(z) for z in zones]


@router.get("/{zone_id}", response_model=DetectionZoneResponse)
async def get_zone(
    zone_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
) -> DetectionZoneResponse:
    """Get a specific zone by ID."""
    repo = DetectionZoneRepository(db)
    zone = await repo.get_by_id(zone_id)
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")
    return DetectionZoneResponse.model_validate(zone)


@router.patch("/{zone_id}", response_model=DetectionZoneResponse)
async def update_zone(
    zone_id: uuid.UUID,
    zone_in: DetectionZoneUpdate,
    db: AsyncSession = Depends(get_db)
) -> DetectionZoneResponse:
    """Update zone configuration."""
    repo = DetectionZoneRepository(db)
    zone = await repo.get_by_id(zone_id)
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")
    updated = await repo.update(zone, zone_in)
    return DetectionZoneResponse.model_validate(updated)


@router.delete("/{zone_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_zone(
    zone_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
) -> None:
    """Delete a detection zone."""
    repo = DetectionZoneRepository(db)
    success = await repo.delete(zone_id)
    if not success:
        raise HTTPException(status_code=404, detail="Zone not found")
