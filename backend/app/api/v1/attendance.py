"""
AI Surveillance System - Attendance API Router

Endpoints for listing, creating, and syncing HRMS attendance records.
"""

import asyncio
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
from app.services.attendance import AttendanceService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/attendance", tags=["Attendance"])
_executor = ThreadPoolExecutor(max_workers=2)


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
