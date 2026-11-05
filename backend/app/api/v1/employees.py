import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.models.membership import Role
from app.schemas.employee import (
    EmployeeCreate,
    EmployeeListResponse,
    EmployeeRecognizeRequest,
    EmployeeRecognizeResponse,
    EmployeeResponse,
)
from app.services.employee import EmployeeService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/employees", tags=["Employees"])


@router.get("", response_model=EmployeeListResponse)
async def list_employees(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=200, ge=1, le=1000),
    search: Optional[str] = Query(default=None, description="Search by name, ID, or department"),
    db: AsyncSession = Depends(get_db),
):
    """
    List all employees with optional search.
    """
    repo = EmployeeService(db).repo
    total, items = await repo.list_employees(skip=skip, limit=limit, search=search)
    return EmployeeListResponse(total=total, items=items)


@router.post("/register", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED)
async def register_employee(
    employee_in: EmployeeCreate,
    db: AsyncSession = Depends(get_db),
    # Optional: restrict to admins depending on requirements
    # current_user = Depends(require_role([Role.TENANT_ADMIN, Role.PLATFORM_ADMIN]))
):
    """
    Register a new employee with a face encoding.
    """
    service = EmployeeService(db)
    employee = await service.register_employee(employee_in)
    return employee


@router.post("/recognize", response_model=EmployeeRecognizeResponse)
async def recognize_employee(
    request: EmployeeRecognizeRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Recognize an employee from a base64 encoded image.
    """
    service = EmployeeService(db)
    return await service.recognize_face(request)


@router.delete("/{employee_id}/face", response_model=EmployeeResponse)
async def remove_employee_face(
    employee_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Remove an employee's face encoding while preserving the employee profile.
    """
    service = EmployeeService(db)
    employee = await service.remove_face_encoding(employee_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee with ID '{employee_id}' not found"
        )
    return employee
