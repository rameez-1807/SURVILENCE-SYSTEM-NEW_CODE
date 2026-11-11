import uuid
from typing import Optional, Any
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, model_validator

class EmployeeBase(BaseModel):
    name: str = Field(..., description="Name of the employee")
    employee_id: str = Field(..., description="Unique employee ID")
    department: Optional[str] = Field(None, description="Department of the employee")
    designation: Optional[str] = Field(None, description="Designation of the employee")
    work_location: Optional[str] = Field(None, description="Assigned work site or building")
    email: Optional[str] = Field(None, description="Work email address")
    phone: Optional[str] = Field(None, description="Mobile contact number")

class EmployeeCreate(EmployeeBase):
    face_encoding: Optional[Any] = Field(None, description="128-d or 512-d float array, or encrypted biometric template dict")

class EmployeeResponse(EmployeeBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: uuid.UUID
    is_enrolled: bool = False
    biometric_model: Optional[str] = None
    created_at: datetime

    @model_validator(mode='before')
    def compute_is_enrolled(cls, data: Any) -> Any:
        def check_encoding(encoding: Any) -> tuple[bool, Optional[str]]:
            if not encoding:
                return False, None
            if isinstance(encoding, list) and len(encoding) in (128, 512):
                return True, "facenox-arcface-512d" if len(encoding) == 512 else "legacy-face-api"
            if isinstance(encoding, dict):
                if encoding.get("encrypted") or "ciphertext" in encoding:
                    return True, encoding.get("model", "facenox-arcface-512d")
                if "embedding" in encoding:
                    return True, encoding.get("model", "facenox-arcface-512d")
            return bool(encoding), "biometric-template"

        if hasattr(data, 'face_encoding'):
            enrolled, model = check_encoding(getattr(data, 'face_encoding'))
            setattr(data, 'is_enrolled', enrolled)
            setattr(data, 'biometric_model', model)
        elif isinstance(data, dict):
            enrolled, model = check_encoding(data.get('face_encoding'))
            data['is_enrolled'] = enrolled
            data['biometric_model'] = model
        return data

class EmployeeRecognizeRequest(BaseModel):
    face_encoding: Optional[list[float]] = Field(None, description="128-d or 512-d float array of face embedding")
    image_base64: Optional[str] = Field(None, description="Base64 image frame for on-server Facenox recognition")

class EmployeeRecognizeResponse(BaseModel):
    match_found: bool
    employee: Optional[EmployeeResponse] = None
    confidence: Optional[float] = None
    engine: str = "facenox"
    liveness: Optional[dict] = None

class FacenoxFrameScanRequest(BaseModel):
    image: str = Field(..., description="Base64 encoded frame from webcam/camera")
    auto_mark_attendance: bool = Field(True, description="Automatically mark attendance in DB if verified")
    enable_liveness: bool = Field(True, description="Run anti-spoofing liveness check")
    camera_name: str = Field("Facenox AI Scanner", description="Source camera identifier")
    punch_type: Optional[str] = Field("in", description="Punch type: 'in' (Punch In / Entry) or 'out' (Punch Out / Exit)")

class FacenoxEnrollRequest(BaseModel):
    employee_id: str = Field(..., description="ID of employee to enroll face for")
    image: str = Field(..., description="Base64 portrait image for enrollment")

class FacenoxRegisterRequest(BaseModel):
    name: str = Field(..., description="Employee Full Name")
    employee_id: str = Field(..., description="Unique Employee ID")
    department: Optional[str] = Field(None, description="Department")
    designation: Optional[str] = Field(None, description="Designation")
    work_location: Optional[str] = Field(None, description="Work location / office")
    email: Optional[str] = Field(None, description="Email address")
    phone: Optional[str] = Field(None, description="Mobile number")
    image: str = Field(..., description="Base64 portrait image captured during scanning")

class EmployeeCheckIdResponse(BaseModel):
    exists: bool
    employee_id: str
    name: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    is_enrolled: Optional[bool] = False

class EmployeeListResponse(BaseModel):
    total: int
    items: list[EmployeeResponse]
