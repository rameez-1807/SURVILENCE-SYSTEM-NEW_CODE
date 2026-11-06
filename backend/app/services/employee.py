import time
import uuid
import math
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.employee import Employee
from app.repositories.employee import EmployeeRepository
from app.schemas.employee import EmployeeCreate, EmployeeRecognizeRequest, EmployeeRecognizeResponse, EmployeeResponse

import logging

logger = logging.getLogger(__name__)

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
            logger.warning("Employee registration conflict for ID: %s", obj_in.employee_id)
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Employee with this ID already exists"
            )

        if obj_in.face_encoding is not None and len(obj_in.face_encoding) != 128:
            logger.warning("Invalid face encoding dimension (%s) for employee ID: %s", len(obj_in.face_encoding), obj_in.employee_id)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid face encoding provided. Must be 128-dimensional array."
            )

        logger.info("Registering employee '%s' (%s) with 128-d face encoding", obj_in.name, obj_in.employee_id)
        # Save to DB
        return await self.repo.create(obj_in, face_encoding=obj_in.face_encoding)

    async def recognize_face(self, obj_in: EmployeeRecognizeRequest) -> EmployeeRecognizeResponse:
        """Recognize a face from image frame or embedding using Facenox SOTA engine."""
        start_time = time.perf_counter()
        
        # 1. Image-based Facenox recognition path
        if obj_in.image_base64:
            from app.core.ai.facenox_engine import facenox_engine
            img = facenox_engine.decode_image(obj_in.image_base64)
            if img is not None:
                employees = await self.repo.list_all_with_encodings()
                emp_dicts = [
                    {
                        "id": emp.id,
                        "name": emp.name,
                        "employee_id": emp.employee_id,
                        "department": emp.department,
                        "designation": emp.designation,
                        "face_encoding": emp.face_encoding
                    }
                    for emp in employees if emp.face_encoding
                ]
                faces = await facenox_engine.scan_and_recognize_frame(img, emp_dicts, enable_liveness=True)
                if faces:
                    top_face = faces[0]
                    if top_face.get("match_found") and top_face.get("employee"):
                        matched = next((e for e in employees if str(e.id) == str(top_face["employee"]["id"])), None)
                        if matched:
                            return EmployeeRecognizeResponse(
                                match_found=True,
                                employee=EmployeeResponse.model_validate(matched),
                                confidence=top_face.get("confidence", 0.95),
                                engine="facenox",
                                liveness=top_face.get("liveness")
                            )

        # 2. Embedding-based recognition path
        incoming_embedding = obj_in.face_encoding
        if not incoming_embedding or len(incoming_embedding) not in (128, 512):
            logger.warning("Recognition rejected: invalid or missing face embedding")
            return EmployeeRecognizeResponse(match_found=False)

        # Fetch all employees with encodings
        employees = await self.repo.list_all_with_encodings()
        
        best_match = None
        best_distance = float('inf')
        best_similarity = 0.0
        is_512d = len(incoming_embedding) == 512
        
        threshold = 0.55 if is_512d else settings.FACE_RECOGNITION_THRESHOLD

        for employee in employees:
            if not employee.face_encoding or len(employee.face_encoding) != len(incoming_embedding):
                continue
            
            if is_512d:
                # Cosine similarity for 512-d ArcFace
                sim = float(np.dot(incoming_embedding, employee.face_encoding))
                if sim >= threshold and sim > best_similarity:
                    best_match = employee
                    best_similarity = sim
            else:
                # Euclidean distance for 128-d
                distance = calculate_euclidean_distance(incoming_embedding, employee.face_encoding)
                if distance < threshold and distance < best_distance:
                    best_match = employee
                    best_distance = distance

        elapsed_ms = (time.perf_counter() - start_time) * 1000.0

        if best_match:
            if is_512d:
                confidence = round(min(1.0, max(0.0, (best_similarity - threshold) / (1.0 - threshold) * 0.5 + 0.5)), 4)
            else:
                confidence = round(max(0.0, 1.0 - (best_distance / threshold)), 4)

            logger.info(
                "Face recognized: employee_id='%s', name='%s', metric=%.4f, confidence=%.2f%%, checked_count=%d, duration=%.2fms",
                best_match.employee_id, best_match.name, best_similarity if is_512d else best_distance, confidence * 100.0, len(employees), elapsed_ms
            )

            # Auto-log event to recognition history DB
            try:
                from app.repositories.recognition_history import RecognitionHistoryRepository
                from app.schemas.recognition_history import RecognitionHistoryCreate

                history_repo = RecognitionHistoryRepository(self.db)
                await history_repo.create(RecognitionHistoryCreate(
                    employee_uuid=best_match.id,
                    employee_id=best_match.employee_id,
                    employee_name=best_match.name,
                    confidence=round(confidence * 100.0, 1),
                    camera_name="Live Camera (Facenox)",
                    status="Recognized"
                ))
            except Exception as e:
                logger.warning("Failed to auto-log recognition history: %s", e)

            response = EmployeeResponse.model_validate(best_match)
            return EmployeeRecognizeResponse(
                match_found=True,
                employee=response,
                confidence=confidence,
                engine="facenox" if is_512d else "face-api"
            )
            
        logger.info(
            "Face recognition result: match_found=False, best_distance=%.4f (threshold=%.2f), checked_count=%d, duration=%.2fms",
            best_distance if best_distance != float('inf') else -1.0, threshold, len(employees), elapsed_ms
        )

        if settings.LOG_UNKNOWN_RECOGNITIONS:
            try:
                from app.repositories.recognition_history import RecognitionHistoryRepository
                from app.schemas.recognition_history import RecognitionHistoryCreate

                history_repo = RecognitionHistoryRepository(self.db)
                await history_repo.create(RecognitionHistoryCreate(
                    employee_uuid=None,
                    employee_id=None,
                    employee_name="Unknown Person",
                    confidence=0.0,
                    camera_name="Live Camera",
                    status="Unknown"
                ))
            except Exception as e:
                logger.warning("Failed to auto-log unknown recognition history: %s", e)

        return EmployeeRecognizeResponse(match_found=False)

    async def remove_face_encoding(self, employee_id: str) -> Optional[Employee]:
        """Unenroll an employee's face encoding while preserving the employee profile."""
        logger.info("Removing face encoding for employee ID: %s", employee_id)
        return await self.repo.remove_face_encoding(employee_id)
