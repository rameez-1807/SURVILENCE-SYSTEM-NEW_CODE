import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, model_validator

class EmployeeBase(BaseModel):
    name: str = Field(..., description="Name of the employee")
    employee_id: str = Field(..., description="Unique employee ID")
    department: str | None = Field(None, description="Department of the employee")
    designation: str | None = Field(None, description="Designation of the employee")

class EmployeeCreate(EmployeeBase):
    face_encoding: list[float] | None = Field(None, description="128-d float array of face embedding")

class EmployeeResponse(EmployeeBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: uuid.UUID
    is_enrolled: bool = False
    created_at: datetime

    @model_validator(mode='before')
    def compute_is_enrolled(cls, data: any) -> any:
        if hasattr(data, 'face_encoding'):
            data.is_enrolled = bool(data.face_encoding and len(data.face_encoding) == 128)
        elif isinstance(data, dict):
            encoding = data.get('face_encoding')
            data['is_enrolled'] = bool(encoding and len(encoding) == 128)
        return data

class EmployeeRecognizeRequest(BaseModel):
    face_encoding: list[float] = Field(..., description="128-d float array of face embedding from the camera feed")

class EmployeeRecognizeResponse(BaseModel):
    match_found: bool
    employee: EmployeeResponse | None = None
    confidence: float | None = None

class EmployeeListResponse(BaseModel):
    total: int
    items: list[EmployeeResponse]
