import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

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
    created_at: datetime

class EmployeeRecognizeRequest(BaseModel):
    face_encoding: list[float] = Field(..., description="128-d float array of face embedding from the camera feed")

class EmployeeRecognizeResponse(BaseModel):
    match_found: bool
    employee: EmployeeResponse | None = None
    confidence: float | None = None

class EmployeeListResponse(BaseModel):
    total: int
    items: list[EmployeeResponse]
