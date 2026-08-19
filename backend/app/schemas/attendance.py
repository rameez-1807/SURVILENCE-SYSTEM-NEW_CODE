"""
AI Surveillance System - Attendance Schemas

Pydantic models for attendance record request/response validation.
"""

import uuid
from datetime import date as DateType, time as TimeType
from pydantic import BaseModel, ConfigDict, Field


class AttendanceRecordCreate(BaseModel):
    """Schema for creating a manual attendance record."""
    employee_id: str = Field(..., description="String employee ID (e.g. EMP-123)")
    attendance_date: DateType = Field(..., description="Date of attendance")
    first_seen: TimeType = Field(..., description="First time seen (check-in)")
    last_seen: TimeType = Field(..., description="Last time seen (check-out)")
    camera_name: str = Field(default="Manual Entry", description="Camera/source name")
    confidence: float = Field(default=100.0, ge=0.0, le=100.0, description="Confidence score (0-100)")


class AttendanceRecordResponse(BaseModel):
    """Schema for returning a single attendance record."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    employee_uuid: uuid.UUID
    employee_id: str | None = None   # string emp id from joined employee
    employee_name: str | None = None  # name from joined employee
    attendance_date: DateType
    first_seen: TimeType
    last_seen: TimeType
    camera_name: str
    confidence: float


class AttendanceListResponse(BaseModel):
    """Schema for paginated attendance list."""
    total: int
    items: list[AttendanceRecordResponse]
