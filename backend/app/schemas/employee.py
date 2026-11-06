import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, model_validator

class EmployeeBase(BaseModel):
    name: str = Field(..., description="Name of the employee")
    employee_id: str = Field(..., description="Unique employee ID")
    department: str | None = Field(None, description="Department of the employee")
    designation: str | None = Field(None, description="Designation of the employee")

class EmployeeCreate(EmployeeBase):
    face_encoding: list[float] | None = Field(None, description="128-d or 512-d float array of face embedding")

class EmployeeResponse(EmployeeBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: uuid.UUID
    is_enrolled: bool = False
    created_at: datetime

    @model_validator(mode='before')
    def compute_is_enrolled(cls, data: any) -> any:
        if hasattr(data, 'face_encoding'):
            data.is_enrolled = bool(data.face_encoding and len(data.face_encoding) in (128, 512))
        elif isinstance(data, dict):
            encoding = data.get('face_encoding')
            data['is_enrolled'] = bool(encoding and len(encoding) in (128, 512))
        return data

class EmployeeRecognizeRequest(BaseModel):
    face_encoding: list[float] | None = Field(None, description="128-d or 512-d float array of face embedding from the camera feed")
    image_base64: str | None = Field(None, description="Base64 image frame for on-server Facenox recognition")

class EmployeeRecognizeResponse(BaseModel):
    match_found: bool
    employee: EmployeeResponse | None = None
    confidence: float | None = None
    engine: str = "facenox"
    liveness: dict | None = None

class FacenoxFrameScanRequest(BaseModel):
    image: str = Field(..., description="Base64 encoded frame from webcam/camera")
    auto_mark_attendance: bool = Field(True, description="Automatically mark attendance in DB if verified")
    enable_liveness: bool = Field(True, description="Run anti-spoofing liveness check")
    camera_name: str = Field("Facenox AI Scanner", description="Source camera identifier")

class FacenoxEnrollRequest(BaseModel):
    employee_id: str = Field(..., description="ID of employee to enroll face for")
    image: str = Field(..., description="Base64 portrait image for enrollment")

class EmployeeListResponse(BaseModel):
    total: int
    items: list[EmployeeResponse]
