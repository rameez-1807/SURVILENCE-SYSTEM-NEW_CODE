"""
AI Surveillance System - Detection Zone Schemas
"""

import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class DetectionZoneBase(BaseModel):
    name: str = Field(..., max_length=100)
    zone_type: str = Field("restricted", description="restricted, entrance, parking, loitering")
    polygon_points: List[List[float]] = Field(..., description="[[x1, y1], [x2, y2], ...] normalized [0, 1]")
    enabled: bool = True
    alert_on_entry: bool = True
    alert_on_loiter: bool = False
    loiter_seconds: int = Field(30, ge=1)
    severity: str = Field("medium", description="low, medium, high, critical")


class DetectionZoneCreate(DetectionZoneBase):
    camera_id: uuid.UUID
    tenant_id: uuid.UUID
    site_id: Optional[uuid.UUID] = None


class DetectionZoneUpdate(BaseModel):
    name: Optional[str] = None
    zone_type: Optional[str] = None
    polygon_points: Optional[List[List[float]]] = None
    enabled: Optional[bool] = None
    alert_on_entry: Optional[bool] = None
    alert_on_loiter: Optional[bool] = None
    loiter_seconds: Optional[int] = None
    severity: Optional[str] = None


class DetectionZoneResponse(DetectionZoneBase):
    id: uuid.UUID
    camera_id: uuid.UUID
    tenant_id: uuid.UUID
    site_id: Optional[uuid.UUID] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
