"""
AI Surveillance System - Attendance API Router

Endpoints for listing and creating attendance records.
"""

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


@router.get("", response_model=AttendanceListResponse)
async def list_attendance_records(
    skip: int = Query(default=0, ge=0, description="Records to skip for pagination"),
    limit: int = Query(default=100, ge=1, le=500, description="Max records to return"),
    filter_date: Optional[DateType] = Query(default=None, alias="date", description="Filter by date (YYYY-MM-DD)"),
    filter_employee_id: Optional[str] = Query(default=None, alias="employee_id", description="Filter by employee string ID"),
    db: AsyncSession = Depends(get_db),
):
    """
    List attendance records with optional date and employee filters.
    Returns employee name and ID joined from the employees table.
    """
    service = AttendanceService(db)
    return await service.list_records(
        skip=skip,
        limit=limit,
        filter_date=filter_date,
        filter_employee_id=filter_employee_id,
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
