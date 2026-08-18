import uuid
import math
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.employee import Employee
from app.repositories.employee import EmployeeRepository
from app.schemas.employee import EmployeeCreate, EmployeeRecognizeRequest, EmployeeRecognizeResponse, EmployeeResponse

def calculate_euclidean_distance(emb1: list[float], emb2: list[float]) -> float:
    if not emb1 or not emb2 or len(emb1) != len(emb2):
        return float('inf')
    return math.sqrt(sum((a - b) ** 2 for a, b in zip(emb1, emb2)))

class EmployeeService:
    """Service handling employee registration and face recognition."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = EmployeeRepository(db)

    async def register_employee(self, obj_in: EmployeeCreate) -> Employee:
        """Register a new employee and their face encoding."""
        
        # Check if employee_id already exists
        existing = await self.repo.get_by_employee_id(obj_in.employee_id)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Employee with this ID already exists"
            )

        if obj_in.face_encoding is not None and len(obj_in.face_encoding) != 128:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid face encoding provided. Must be 128-dimensional array."
            )

        # Save to DB
        return await self.repo.create(obj_in, face_encoding=obj_in.face_encoding)

    async def recognize_face(self, obj_in: EmployeeRecognizeRequest) -> EmployeeRecognizeResponse:
        """Recognize a face from a face embedding against known employees."""
        
        incoming_embedding = obj_in.face_encoding
        if not incoming_embedding or len(incoming_embedding) != 128:
            return EmployeeRecognizeResponse(match_found=False)

        # Fetch all employees with encodings
        employees = await self.repo.list_all_with_encodings()
        
        best_match = None
        best_distance = float('inf')
        
        # Threshold for face-api.js SSD MobileNet v1 is typically ~0.6 for distance
        THRESHOLD = 0.6

        for employee in employees:
            if not employee.face_encoding:
                continue
                
            distance = calculate_euclidean_distance(incoming_embedding, employee.face_encoding)
            
            if distance < THRESHOLD and distance < best_distance:
                best_match = employee
                best_distance = distance

        if best_match:
            response = EmployeeResponse.model_validate(best_match)
            return EmployeeRecognizeResponse(
                match_found=True,
                employee=response,
                confidence=max(0.0, 1.0 - (best_distance / THRESHOLD))
            )
            
        return EmployeeRecognizeResponse(match_found=False)
