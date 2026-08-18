import uuid
from datetime import datetime
from typing import Optional, Dict, Any

from pydantic import BaseModel, ConfigDict


class RuleBase(BaseModel):
    name: str
    enabled: bool = True
    detection_class: str
    confidence_threshold: float = 0.5
    zone_configuration: Optional[Dict[str, Any]] = None
    schedule_configuration: Optional[Dict[str, Any]] = None
    severity: str = "medium"


class RuleCreate(RuleBase):
    tenant_id: uuid.UUID
    site_id: Optional[uuid.UUID] = None


class RuleUpdate(BaseModel):
    name: Optional[str] = None
    enabled: Optional[bool] = None
    detection_class: Optional[str] = None
    confidence_threshold: Optional[float] = None
    zone_configuration: Optional[Dict[str, Any]] = None
    schedule_configuration: Optional[Dict[str, Any]] = None
    severity: Optional[str] = None


class RuleResponse(RuleBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    site_id: Optional[uuid.UUID] = None
    version: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
