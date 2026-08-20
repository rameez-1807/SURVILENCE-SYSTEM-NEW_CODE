import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field

class RecognitionHistoryCreate(BaseModel):
    """Schema for creating a face recognition history record."""
    employee_uuid: Optional[uuid.UUID] = None
    employee_id: Optional[str] = None
    employee_name: Optional[str] = None
    confidence: float = Field(..., ge=0.0, le=100.0, description="Confidence percentage or score")
    camera_name: str = Field(default="Live Camera")
    status: str = Field(default="Recognized")

class RecognitionHistoryResponse(BaseModel):
    """Schema for returning recognition history records."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    employee_uuid: Optional[uuid.UUID] = None
    employee_id: Optional[str] = None
    employee_name: Optional[str] = None
    confidence: float
    camera_name: str
    status: str
    timestamp: datetime

class RecognitionHistoryListResponse(BaseModel):
    """Schema for paginated recognition history response."""
    items: list[RecognitionHistoryResponse]
    total: int
    page: int
    limit: int
    pages: int

class RecognitionDashboardStats(BaseModel):
    """Schema for face recognition dashboard aggregated statistics."""
    total_registered_employees: int
    recognized_faces_today: int
    unknown_faces_today: int
    attendance_marked_today: int
    trend_data: list[dict]
    distribution_data: list[dict]
    recent_activity: list[RecognitionHistoryResponse]
