import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


class EvidenceItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    media_type: str = "snapshot"          # 'snapshot' ya 'video'
    detection_type: str = "vehicle"       # 'vehicle', 'face', 'object', 'intrusion'
    event_name: str                       # e.g., 'Vehicle Detected', 'Unauthorized Entry'
    timestamp: datetime
    camera_name: str
    employee_info: Optional[str] = None
    vehicle_info: Optional[str] = None    # e.g., 'JH03MF4477'
    evidence_reference: str               # File name
    media_url: Optional[str] = None       # Direct URL to view photo in browser


class EvidenceListResponse(BaseModel):
    total: int
    items: List[EvidenceItemResponse]


class SignedUrlResponse(BaseModel):
    evidence_id: uuid.UUID
    download_url: str
    expires_in_seconds: int = 300
