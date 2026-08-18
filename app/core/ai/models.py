import uuid
from typing import Any, List, Optional
from datetime import datetime
from pydantic import BaseModel, Field

from app.core.camera.state import FrameMetadata


class FrameEnvelope:
    """Unified carrier for a video frame and its metadata."""
    def __init__(self, metadata: FrameMetadata, frame_data: Any):
        self.metadata = metadata
        self.frame_data = frame_data


class DetectionResult(BaseModel):
    """Standardized output for any AI detection model."""
    camera_id: uuid.UUID
    frame_id: int
    observed_at: datetime
    confidence: float = Field(..., ge=0.0, le=1.0)
    bounding_box: List[float] = Field(..., description="[x_min, y_min, x_max, y_max]")
    model_id: str
    model_version: str
    processing_time_ms: float
    label: str = "unknown"


class PluginManifest(BaseModel):
    """Metadata describing an AI Plugin."""
    id: str
    name: str
    version: str
    description: Optional[str] = None
    supported_architectures: List[str] = ["cpu"]
