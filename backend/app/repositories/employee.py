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
        await self.db.commit()
        await self.db.refresh(db_obj)

        try:
            from app.db.mongodb import get_async_db
            mongo_db = get_async_db()
            mongo_doc = {
                "_id": str(db_obj.id),
                "id": str(db_obj.id),
                "name": db_obj.name,
                "employee_id": db_obj.employee_id,
                "department": db_obj.department,
                "designation": db_obj.designation,
                "face_encoding": db_obj.face_encoding,
                "created_at": db_obj.created_at,
            }
            await mongo_db.employees.replace_one({"_id": str(db_obj.id)}, mongo_doc, upsert=True)
        except Exception:
            pass

        return db_obj

    async def delete(self, employee_id: uuid.UUID) -> bool:
        """Delete an employee."""
        stmt = delete(Employee).where(Employee.id == employee_id)
        result = await self.db.execute(stmt)
        await self.db.commit()

        try:
            from app.db.mongodb import get_async_db
            mongo_db = get_async_db()
            await mongo_db.employees.delete_one({"_id": str(employee_id)})
        except Exception:
            pass

        return result.rowcount > 0

    async def remove_face_encoding(self, employee_id: str) -> Optional[Employee]:
        """Remove face encoding for an employee while keeping the employee record in DB."""
        emp = await self.get_by_employee_id(employee_id)
        if not emp:
            return None
        emp.face_encoding = None
        await self.db.commit()
        await self.db.refresh(emp)

        try:
            from app.db.mongodb import get_async_db
            mongo_db = get_async_db()
            await mongo_db.employees.update_one(
                {"employee_id": employee_id},
                {"$set": {"face_encoding": None}}
            )
        except Exception:
            pass

        return emp
