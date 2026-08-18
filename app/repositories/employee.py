import uuid
from typing import Optional

from sqlalchemy import delete, select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.employee import Employee
from app.schemas.employee import EmployeeCreate


class EmployeeRepository:
    """Repository that encapsulates employee database operations."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(self, employee_id: uuid.UUID) -> Optional[Employee]:
        """Get an employee by its ID."""
        stmt = select(Employee).where(Employee.id == employee_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_employee_id(self, employee_id: str) -> Optional[Employee]:
        """Get an employee by their unique string employee_id."""
        stmt = select(Employee).where(Employee.employee_id == employee_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def list_all_with_encodings(self) -> list[Employee]:
        """List all employees that have a face encoding."""
        stmt = select(Employee).where(Employee.face_encoding.is_not(None))
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def list_employees(self, skip: int = 0, limit: int = 100) -> tuple[int, list[Employee]]:
        """List employees paginated."""
        count_stmt = select(func.count()).select_from(Employee)
        count_result = await self.db.execute(count_stmt)
        total = count_result.scalar_one()

        stmt = select(Employee).offset(skip).limit(limit).order_by(Employee.created_at.desc())
        result = await self.db.execute(stmt)
        items = list(result.scalars().all())
        return total, items

    async def create(self, obj_in: EmployeeCreate, face_encoding: list[float]) -> Employee:
        """Create a new employee with face encoding."""
        db_obj = Employee(
            name=obj_in.name,
            employee_id=obj_in.employee_id,
            face_encoding=face_encoding,
            department=obj_in.department,
            designation=obj_in.designation
        )
        self.db.add(db_obj)
        await self.db.flush()
        await self.db.refresh(db_obj)
        return db_obj

    async def delete(self, employee_id: uuid.UUID) -> bool:
        """Delete an employee."""
        stmt = delete(Employee).where(Employee.id == employee_id)
        result = await self.db.execute(stmt)
        return result.rowcount > 0
