"""
AI Surveillance System - Attendance API Router

Endpoints for listing, creating, and syncing HRMS attendance records.
"""

import asyncio
import time
from concurrent.futures import ThreadPoolExecutor
import logging
from datetime import date as DateType
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.schemas.attendance import (
    AttendanceListResponse,
    AttendanceRecordCreate,
    AttendanceRecordResponse,
)
from app.schemas.employee import FacenoxFrameScanRequest
from app.services.attendance import AttendanceService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/attendance", tags=["Attendance"])
_executor = ThreadPoolExecutor(max_workers=2)

# In-memory cooldown (employee_id -> last_marked_timestamp)
_facenox_cooldown: dict[str, float] = {}
COOLDOWN_SECONDS = 60.0


@router.get("", response_model=AttendanceListResponse)
async def list_attendance_records(
    skip: int = Query(default=0, ge=0, description="Records to skip for pagination"),
    limit: int = Query(default=500, ge=1, le=1000, description="Max records to return"),
    filter_date: Optional[DateType] = Query(default=None, alias="date", description="Filter by date (YYYY-MM-DD)"),
    filter_employee_id: Optional[str] = Query(default=None, alias="employee_id", description="Filter by employee string ID"),
    search: Optional[str] = Query(default=None, description="Search by employee name or ID"),
    db: AsyncSession = Depends(get_db),
):
    """
    List attendance records with optional date, employee, and search filters.
    Returns employee name and ID joined from the employees table.
    """
    service = AttendanceService(db)
    return await service.list_records(
        skip=skip,
        limit=limit,
        filter_date=filter_date,
        filter_employee_id=filter_employee_id,
        search=search,
    )


@router.post("", response_model=AttendanceRecordResponse, status_code=status.HTTP_201_CREATED)
async def create_attendance_record(
    record_in: AttendanceRecordCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Manually create an attendance record for a registered employee.
    The employee must already exist in the database (use /employees/register first).
    """
    service = AttendanceService(db)
    return await service.create_record(record_in)


@router.post("/facenox-scan")
async def scan_frame_facenox(
    payload: FacenoxFrameScanRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Real-time Facenox frame scanning with Anti-Spoofing and Automatic Attendance Tracking:
      1. Detects all faces using OpenCV YuNet FaceDetectorYN
      2. Multi-subject ByteTrack tracking
      3. Anti-Spoofing Liveness check (rejects digital photos / mobile replays)
      4. SOTA ArcFace 512-d normalized embedding extraction
      5. Vectorized Cosine Similarity matching against MySQL enrolled employees
      6. If recognized and liveness passes, automatically logs attendance in MySQL!
    """
    from datetime import datetime, timezone
    from app.core.ai.facenox_engine import facenox_engine
    from app.repositories.employee import EmployeeRepository

    if not facenox_engine.is_ready:
        return {
            "success": False,
            "error": "Facenox engine not initialized or models missing.",
            "faces_detected": 0,
            "faces": []
        }

    image = facenox_engine.decode_image(payload.image)
    if image is None:
        return {
            "success": False,
            "error": "Invalid frame or base64 image data.",
            "faces_detected": 0,
            "faces": []
        }

    # Fetch enrolled employees from MySQL
    emp_repo = EmployeeRepository(db)
    employees = await emp_repo.list_all_with_encodings()
    emp_records = [
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

    # Run complete Facenox pipeline
    faces = await facenox_engine.scan_and_recognize_frame(
        image=image,
        enrolled_employees=emp_records,
        similarity_threshold=0.55,
        enable_liveness=payload.enable_liveness,
        client_id=payload.camera_name or "facenox_scanner"
    )

    attendance_events = []
    now = datetime.now()
    today_date = now.date()
    current_time_str = now.strftime("%H:%M:%S")

    # If employee is matched & liveness is verified real, auto-mark attendance
    for face in faces:
        face["attendance_marked"] = False
        face["attendance_cooldown"] = False

        if face.get("match_found") and face.get("employee"):
            emp_info = face["employee"]
            emp_id = emp_info["employee_id"]
            is_real = face.get("liveness", {}).get("is_real", True)

            # Block spoofing attacks
            if not is_real:
                face["attendance_blocked_reason"] = "Anti-spoofing triggered: spoof detected"
                continue

            # Check duplicate cooldown
            last_marked = _facenox_cooldown.get(emp_id, 0.0)
            if (time.time() - last_marked) < COOLDOWN_SECONDS:
                face["attendance_cooldown"] = True
                face["attendance_message"] = f"Already marked check-in ({round(COOLDOWN_SECONDS - (time.time() - last_marked))}s cooldown)"
                continue

            if payload.auto_mark_attendance:
                try:
                    att_service = AttendanceService(db)
                    rec = await att_service.create_record(AttendanceRecordCreate(
                        employee_id=emp_id,
                        attendance_date=today_date,
                        first_seen=now.time(),
                        last_seen=now.time(),
                        camera_name=payload.camera_name,
                        confidence=int(face.get("confidence", 0.95) * 100),
                    ))
                    _facenox_cooldown[emp_id] = time.time()
                    face["attendance_marked"] = True
                    face["attendance_time"] = current_time_str
                    attendance_events.append({
                        "employee_id": emp_id,
                        "name": emp_info["name"],
                        "time": current_time_str,
                        "confidence": face.get("confidence"),
                    })
                    logger.info("Facenox Attendance Auto-Marked: %s at %s", emp_info["name"], current_time_str)
                except Exception as exc:
                    logger.warning("Facenox attendance auto-mark error for %s: %s", emp_id, exc)

    return {
        "success": True,
        "engine": "Facenox AI (YuNet + Anti-Spoofing + ArcFace 512d)",
        "faces_detected": len(faces),
        "faces": faces,
        "attendance_events": attendance_events
    }


@router.post("/sync-hrms")
async def sync_hrms_attendance():
    """
    Synchronize attendance records and employee roster from external HRMS:
    https://hrmsapi.leanxpert.in/api/ManualAttendance
    """
    loop = asyncio.get_running_loop()
    try:
        from scripts.feed_hrms_attendance import sync_hrms_data
        result = await loop.run_in_executor(_executor, sync_hrms_data)
        return result
    except Exception as exc:
        logger.error(f"HRMS sync failed: {exc}", exc_info=True)
        return {"status": "error", "message": str(exc)}
