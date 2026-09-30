import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class EventBase(BaseModel):
    event_type: str
    severity: str = "low"
    state: str = "OPEN"
    observed_at: datetime
    confidence: float
    needs_review: bool = False
    is_llm_verified: bool = False
    corrected_label: Optional[str] = None
    model_id: str
    model_version: str
    evidence_reference: Optional[str] = None
    dedupe_key: str
    rule_id: Optional[uuid.UUID] = None
    track_id: Optional[int] = None


class EventCreate(EventBase):
    tenant_id: uuid.UUID
    site_id: uuid.UUID
    camera_id: uuid.UUID


class EventUpdate(BaseModel):
    state: Optional[str] = None
    evidence_reference: Optional[str] = None


class CorrectLabelRequest(BaseModel):
    corrected_label: str


class StateTransitionRequest(BaseModel):
    reason: Optional[str] = None


class EventResponse(EventBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    site_id: uuid.UUID
    camera_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
