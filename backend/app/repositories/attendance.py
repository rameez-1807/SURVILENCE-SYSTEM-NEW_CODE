"""
AI Surveillance System - Attendance Repository

Data access layer for attendance records.
"""

import uuid
from datetime import date as DateType
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.attendance import AttendanceRecord
from app.models.employee import Employee
from app.schemas.attendance import AttendanceRecordCreate


class AttendanceRepository:
    """Repository that encapsulates attendance database operations."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, obj_in: AttendanceRecordCreate, employee_uuid: uuid.UUID) -> AttendanceRecord:
        """Create a new attendance record linked to an employee UUID."""
        db_obj = AttendanceRecord(
            employee_uuid=employee_uuid,
            date=obj_in.attendance_date,
            first_seen=obj_in.first_seen,
            last_seen=obj_in.last_seen,
            camera_name=obj_in.camera_name,
            confidence=obj_in.confidence,
        )
        self.db.add(db_obj)
        await self.db.flush()
        await self.db.refresh(db_obj)
        return db_obj

    async def get_by_id(self, record_id: uuid.UUID) -> Optional[AttendanceRecord]:
        """Get a single attendance record by its UUID, with employee loaded."""
        stmt = (
            select(AttendanceRecord)
            .where(AttendanceRecord.id == record_id)
            .options(joinedload(AttendanceRecord.employee))
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_records(
        self,
        skip: int = 0,
        limit: int = 100,
        filter_date: Optional[DateType] = None,
        filter_employee_id: Optional[str] = None,
    ) -> tuple[int, list[AttendanceRecord]]:
        """List attendance records with optional filters, paginated, joining employee data."""

        base_stmt = (
            select(AttendanceRecord)
            .options(joinedload(AttendanceRecord.employee))
            .join(Employee, AttendanceRecord.employee_uuid == Employee.id)
        )

        # Apply filters
        if filter_date:
            base_stmt = base_stmt.where(AttendanceRecord.date == filter_date)
        if filter_employee_id:
            base_stmt = base_stmt.where(Employee.employee_id == filter_employee_id)

        # Count query
        count_stmt = select(func.count()).select_from(base_stmt.subquery())
        count_result = await self.db.execute(count_stmt)
        total = count_result.scalar_one()

        # Data query
        data_stmt = (
            base_stmt
            .order_by(AttendanceRecord.date.desc())
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(data_stmt)
        items = list(result.scalars().all())

        return total, items
