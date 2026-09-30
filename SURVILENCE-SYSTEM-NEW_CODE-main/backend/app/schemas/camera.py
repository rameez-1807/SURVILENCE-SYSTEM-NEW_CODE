"""
AI Surveillance System - Camera Schemas

Pydantic models for Camera validation.
"""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.camera import CameraStatus


class CameraBase(BaseModel):
    """Shared properties for all camera schemas."""
    name: str = Field(..., description="Name of the camera")
    protocol: str = Field(default="rtsp", description="Streaming protocol (rtsp, onvif, etc)")
    host: str = Field(..., description="IP address or hostname")
    stream_path: str = Field(..., description="Path for the stream (e.g. /cam/realmonitor?channel=1&subtype=0)")
    stream_profile: Optional[str] = Field(None, description="High/low res stream profile name")
    timezone: str = Field(default="UTC", description="Camera timezone")


class CameraCreate(CameraBase):
    """Schema for creating a new camera."""
    tenant_id: uuid.UUID
    site_id: uuid.UUID
    credential_reference: Optional[str] = Field(
        None, 
        description="Reference to credentials (e.g., Vault path or encrypted string). NEVER returned in responses."
    )


class CameraUpdate(BaseModel):
    """Schema for updating an existing camera."""
    name: Optional[str] = None
    protocol: Optional[str] = None
    host: Optional[str] = None
    stream_path: Optional[str] = None
    stream_profile: Optional[str] = None
    timezone: Optional[str] = None
    status: Optional[CameraStatus] = None
    credential_reference: Optional[str] = None


class CameraResponse(CameraBase):
    """
    Schema for returning a camera safely to the client.
    Notice the deliberate OMISSION of credential_reference.
    """
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    site_id: uuid.UUID
    status: CameraStatus
    created_at: datetime
    updated_at: datetime


class CameraListResponse(BaseModel):
    """Schema for a paginated list of cameras."""
    total: int
    items: list[CameraResponse]


class CameraHealthResponse(BaseModel):
    """Mock schema for camera health check."""
    status: str = "healthy"
    latency_ms: int = 15


class PreviewTokenResponse(BaseModel):
    """Mock schema for getting a stream preview token."""
    preview_url: str
    token: str
    expires_in_seconds: int = 3600
