"""
AI Surveillance System - Attendance Service

Business logic for creating and querying attendance records.
"""

from datetime import date as DateType
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.attendance import AttendanceRepository
from app.repositories.employee import EmployeeRepository
from app.schemas.attendance import AttendanceRecordCreate, AttendanceRecordResponse, AttendanceListResponse


class AttendanceService:
    """Service handling attendance record creation and retrieval."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = AttendanceRepository(db)
        self.emp_repo = EmployeeRepository(db)

    async def create_record(self, obj_in: AttendanceRecordCreate) -> AttendanceRecordResponse:
        """
        Create a manual attendance record.
        Looks up the employee by their string employee_id to get the UUID.
        """
        # Find employee by their string ID (e.g. "EMP-001")
        employee = await self.emp_repo.get_by_employee_id(obj_in.employee_id)
        if not employee:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Employee with ID '{obj_in.employee_id}' not found. Please register the employee first."
            )

        # Create record
        record = await self.repo.create(obj_in, employee_uuid=employee.id)

        # Build response with joined employee fields
        return AttendanceRecordResponse(
            id=record.id,
            employee_uuid=record.employee_uuid,
            employee_id=employee.employee_id,
            employee_name=employee.name,
            attendance_date=record.date,
            first_seen=record.first_seen,
            last_seen=record.last_seen,
            camera_name=record.camera_name,
            confidence=record.confidence,
        )

    async def list_records(
        self,
        skip: int = 0,
        limit: int = 100,
        filter_date: Optional[DateType] = None,
        filter_employee_id: Optional[str] = None,
    ) -> AttendanceListResponse:
        """List attendance records with optional filters, enriched with employee info."""
        total, records = await self.repo.list_records(
            skip=skip,
            limit=limit,
            filter_date=filter_date,
            filter_employee_id=filter_employee_id,
        )

        items = []
        for record in records:
            emp = record.employee
            items.append(
                AttendanceRecordResponse(
                    id=record.id,
                    employee_uuid=record.employee_uuid,
                    employee_id=emp.employee_id if emp else None,
                    employee_name=emp.name if emp else None,
                    attendance_date=record.date,
                    first_seen=record.first_seen,
                    last_seen=record.last_seen,
                    camera_name=record.camera_name,
                    confidence=record.confidence,
                )
            )

        return AttendanceListResponse(total=total, items=items)
