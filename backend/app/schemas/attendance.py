"""
AI Surveillance System - Attendance Schemas

Pydantic models for attendance record request/response validation.
"""

import uuid
from typing import Optional
from datetime import date as DateType, time as TimeType
from pydantic import BaseModel, ConfigDict, Field


class AttendanceRecordCreate(BaseModel):
    """Schema for creating a manual attendance record."""
    employee_id: str = Field(..., description="String employee ID (e.g. EMP-123)")
    employee_name: Optional[str] = Field(default=None, description="Employee full name (used to auto-register if new)")
    face_image: Optional[str] = Field(default=None, description="Base64 face image to enroll biometric template if new")
    attendance_date: DateType = Field(..., description="Date of attendance")
    first_seen: TimeType = Field(..., description="First time seen (check-in / punch in)")
    last_seen: Optional[TimeType] = Field(default=None, description="Last time seen (check-out / punch out)")
    camera_name: str = Field(default="Manual Entry", description="Camera/source name")
    confidence: float = Field(default=100.0, ge=0.0, le=100.0, description="Confidence score (0-100)")
    punch_type: Optional[str] = Field(default="in", description="Punch type: 'in' (Entry) or 'out' (Exit)")


class AttendancePunchRequest(BaseModel):
    """Schema for quick 1-click Punch In or Punch Out."""
    employee_id: str = Field(..., description="Employee String ID (e.g. 103)")
    employee_name: Optional[str] = Field(default=None, description="Optional employee name for auto-creation")
    punch_type: str = Field(default="in", description="'in' for Punch In, 'out' for Punch Out")
    camera_name: Optional[str] = Field(default="Facenox Scanner", description="Source camera")
    confidence: Optional[float] = Field(default=100.0, ge=0.0, le=100.0)
    attendance_date: Optional[DateType] = Field(default=None, description="Optional date override (defaults to today)")
    punch_time: Optional[TimeType] = Field(default=None, description="Optional time override (defaults to current time)")


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
