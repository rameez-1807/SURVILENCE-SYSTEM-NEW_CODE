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
        Create or update an attendance record.
        Looks up the employee by string employee_id and prevents duplicate daily rows.
        If employee does not exist and employee_name is provided, auto-registers employee.
        """
        if not obj_in.last_seen:
            obj_in.last_seen = obj_in.first_seen

        # Find employee by string ID (e.g. "EMP-001")
        employee = await self.emp_repo.get_by_employee_id(obj_in.employee_id)
        if not employee:
            if obj_in.employee_name and obj_in.employee_name.strip():
                # Auto-register new employee so manual entry never fails
                from app.schemas.employee import EmployeeCreate
                from app.services.employee import EmployeeService
                emp_service = EmployeeService(self.db)

                embedding = None
                if obj_in.face_image:
                    try:
                        from app.core.ai.facenox_engine import facenox_engine
                        if facenox_engine.is_ready:
                            img = facenox_engine.decode_image(obj_in.face_image)
                            if img is not None:
                                ok, emb, _ = await facenox_engine.extract_face_embedding(img)
                                if ok and emb:
                                    embedding = emb
                    except Exception as e:
                        logger.warning("Failed to extract face embedding during manual attendance auto-enroll: %s", e)

                new_emp_in = EmployeeCreate(
                    name=obj_in.employee_name.strip(),
                    employee_id=obj_in.employee_id.strip(),
                    face_encoding=embedding
                )
                employee = await emp_service.register_employee(new_emp_in)
                logger.info("Auto-registered employee %s (%s) from manual attendance workflow", employee.name, employee.employee_id)
            else:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Employee with ID '{obj_in.employee_id}' not found. Please provide Full Name to register."
                )

        # Check for existing attendance on the same date for this employee
        existing_record = await self.repo.get_by_employee_and_date(employee.id, obj_in.attendance_date)
        if existing_record:
            punch = (getattr(obj_in, "punch_type", None) or "in").lower()
            if punch == "out":
                # Punch Out: update exit time (last_seen)
                record = await self.repo.update_last_seen(existing_record, obj_in.last_seen or obj_in.first_seen, obj_in.confidence)
            elif punch == "in":
                # Punch In: update entry time (first_seen) if not set or requested
                record = await self.repo.update_first_seen(existing_record, obj_in.first_seen, obj_in.confidence)
            else:
                record = await self.repo.update_last_seen(existing_record, obj_in.last_seen, obj_in.confidence)
        else:
            # Create new record for today
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

    async def punch_record(
        self,
        employee_id: str,
        punch_type: str = "in",
        camera_name: str = "Facenox Live Scanner",
        confidence: float = 100.0,
        punch_date: Optional[DateType] = None,
        punch_time: any = None,
        employee_name: Optional[str] = None,
    ) -> AttendanceRecordResponse:
        """1-Click Punch In or Punch Out for an employee."""
        from datetime import datetime
        from zoneinfo import ZoneInfo
        tz = ZoneInfo("Asia/Kolkata")
        now_ist = datetime.now(tz)
        target_date = punch_date or now_ist.date()
        target_time = punch_time or now_ist.time()

        employee = await self.emp_repo.get_by_employee_id(employee_id)
        if not employee:
            if employee_name and employee_name.strip():
                from app.schemas.employee import EmployeeCreate
                from app.services.employee import EmployeeService
                emp_service = EmployeeService(self.db)
                new_emp_in = EmployeeCreate(name=employee_name.strip(), employee_id=employee_id.strip())
                employee = await emp_service.register_employee(new_emp_in)
            else:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Employee with ID '{employee_id}' not found."
                )

        existing = await self.repo.get_by_employee_and_date(employee.id, target_date)
        ptype = punch_type.strip().lower()

        if existing:
            if ptype == "out":
                # Punch Out: update exit time
                record = await self.repo.update_last_seen(existing, target_time, confidence)
            else:
                # Punch In: update entry time
                record = await self.repo.update_first_seen(existing, target_time, confidence)
        else:
            obj_in = AttendanceRecordCreate(
                employee_id=employee.employee_id,
                attendance_date=target_date,
                first_seen=target_time,
                last_seen=target_time,
                camera_name=camera_name,
                confidence=confidence,
                punch_type=ptype,
            )
            record = await self.repo.create(obj_in, employee_uuid=employee.id)

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
        limit: int = 500,
        filter_date: Optional[DateType] = None,
        filter_employee_id: Optional[str] = None,
        search: Optional[str] = None,
    ) -> AttendanceListResponse:
        """List attendance records with optional filters, enriched with employee info."""
        total, records = await self.repo.list_records(
            skip=skip,
            limit=limit,
            filter_date=filter_date,
            filter_employee_id=filter_employee_id,
            search=search,
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
