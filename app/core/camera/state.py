"""
AI Surveillance System - Camera State Models

Defines the state machines and metadata structures for camera streams.
"""

import enum
import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class CameraState(str, enum.Enum):
    """
    RTSP connection states.
    """
    CONNECTING = "connecting"
    ONLINE = "online"
    DEGRADED = "degraded"
    OFFLINE = "offline"
    AUTH_FAILED = "auth_failed"
    RECONNECTING = "reconnecting"


class FrameMetadata(BaseModel):
    """
    Metadata attached to every single captured frame.
    """
    camera_id: uuid.UUID
    frame_id: int
    timestamp: datetime
    stream_profile: Optional[str] = None
    trace_id: str = Field(..., description="Unique ID for this frame's lifecycle.")


class CameraHealth(BaseModel):
    """
    Real-time health telemetry for a camera connection.
    """
    camera_id: uuid.UUID
    connection_state: CameraState
    fps: float = 0.0
    last_frame_timestamp: Optional[datetime] = None
    reconnect_count: int = 0
    frame_failures: int = 0
