"""
AI Surveillance System - Attendance API Router

Endpoints for listing, creating, and syncing HRMS attendance records,
plus real-time Facenox on-device biometric scanning with anti-spoofing and auto-attendance.
"""

import asyncio
import time
from concurrent.futures import ThreadPoolExecutor
import logging
from datetime import datetime, date as DateType
from zoneinfo import ZoneInfo
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
from app.repositories.attendance import AttendanceRepository
from app.repositories.employee import EmployeeRepository

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/attendance", tags=["Attendance"])
_executor = ThreadPoolExecutor(max_workers=2)

# In-memory cooldown (employee_id -> last_marked_timestamp)
_facenox_cooldown: dict[str, float] = {}
COOLDOWN_SECONDS = 30.0

ATTENDANCE_TZ = ZoneInfo("Asia/Kolkata")


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
      6. Timezone-aware (Asia/Kolkata) automatic attendance marking:
         - New check-in: creates row in attendance_records
         - Repeat observation: updates last_seen timestamp
         - Idempotent with cooldown to prevent frame spamming
    """
    from app.core.ai.facenox_engine import facenox_engine

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

    # Fetch enrolled employees from MySQL with in-memory decrypted embeddings
    emp_repo = EmployeeRepository(db)
    employees = await emp_repo.list_all_with_encodings()
    emp_records = [
        {
            "id": emp.id,
            "name": emp.name,
            "employee_id": emp.employee_id,
            "department": emp.department,
            "designation": emp.designation,
            "face_encoding": getattr(emp, "decrypted_embedding", None) or emp.face_encoding
        }
        for emp in employees if (getattr(emp, "decrypted_embedding", None) or emp.face_encoding)
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
    # Timezone-aware current time in Asia/Kolkata
    now_ist = datetime.now(ATTENDANCE_TZ)
    today_date = now_ist.date()
    current_time = now_ist.time()
    current_time_str = now_ist.strftime("%H:%M:%S")

    att_repo = AttendanceRepository(db)

    # Process attendance for recognized real human faces
    for face in faces:
        face["attendance_marked"] = False
        face["attendance_already_marked"] = False
        face["attendance_cooldown"] = False

        if face.get("match_found") and face.get("employee"):
            emp_info = face["employee"]
            emp_id = emp_info["employee_id"]
            emp_uuid = emp_info["id"]
            is_real = face.get("liveness", {}).get("is_real", True)

            # Block spoofing attacks
            if not is_real:
                face["attendance_blocked_reason"] = "Anti-spoofing alert: digital photo or screen replay detected"
                continue

            # Query existing attendance record for today in MySQL
            existing_record = None
            try:
                import uuid as _uuid
                existing_record = await att_repo.get_by_employee_and_date(
                    _uuid.UUID(str(emp_uuid)),
                    today_date
                )
            except Exception as e:
                logger.debug("Error checking existing attendance: %s", e)

            # Cooldown check for repeated frames
            last_marked = _facenox_cooldown.get(emp_id, 0.0)
            in_cooldown = (time.time() - last_marked) < COOLDOWN_SECONDS

            if existing_record:
                # Employee has already checked in today!
                face["attendance_already_marked"] = True
                first_seen_str = existing_record.first_seen.strftime("%H:%M:%S") if existing_record.first_seen else current_time_str
                face["attendance_time"] = first_seen_str
                face["attendance_message"] = f"Attendance Already Marked (Check-in at {first_seen_str})"

                if not in_cooldown and payload.auto_mark_attendance:
                    try:
                        # Update last_seen on existing record
                        await att_repo.update_last_seen(
                            existing_record,
                            current_time,
                            int(face.get("confidence", 0.95) * 100)
                        )
                        _facenox_cooldown[emp_id] = time.time()
                    except Exception as err:
                        logger.warning("Failed to update last_seen for %s: %s", emp_id, err)

                if in_cooldown:
                    face["attendance_cooldown"] = True
            else:
                # First check-in of the day!
                if payload.auto_mark_attendance and not in_cooldown:
                    try:
                        import uuid as _uuid
                        rec = await att_repo.create(
                            AttendanceRecordCreate(
                                employee_id=emp_id,
                                attendance_date=today_date,
                                first_seen=current_time,
                                last_seen=current_time,
                                camera_name=payload.camera_name,
                                confidence=int(face.get("confidence", 0.95) * 100),
                            ),
                            employee_uuid=_uuid.UUID(str(emp_uuid))
                        )
                        _facenox_cooldown[emp_id] = time.time()
                        face["attendance_marked"] = True
                        face["attendance_time"] = current_time_str
                        face["attendance_message"] = f"Attendance Marked Successfully ({current_time_str})"

                        attendance_events.append({
                            "employee_id": emp_id,
                            "name": emp_info["name"],
                            "time": current_time_str,
                            "status": "Checked In",
                            "confidence": face.get("confidence"),
                        })
                        logger.info("Facenox Attendance Auto-Marked: %s at %s IST", emp_info["name"], current_time_str)
                    except Exception as exc:
                        logger.warning("Facenox attendance auto-mark error for %s: %s", emp_id, exc)

    return {
        "success": True,
        "engine": "Facenox AI (YuNet + Anti-Spoofing + ArcFace 512d)",
        "faces_detected": len(faces),
        "faces": faces,
        "attendance_events": attendance_events,
        "timestamp_ist": current_time_str,
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
