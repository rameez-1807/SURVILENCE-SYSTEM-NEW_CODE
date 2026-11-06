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
    EmployeeCheckIdResponse,
    FacenoxEnrollRequest,
    FacenoxRegisterRequest,
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


@router.get("/check-id/{employee_id}", response_model=EmployeeCheckIdResponse)
async def check_employee_id(
    employee_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Verify if an employee ID already exists to prevent duplicate registrations.
    """
    service = EmployeeService(db)
    return await service.check_id(employee_id)


@router.post("/register", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED)
async def register_employee(
    employee_in: EmployeeCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Register a new employee with a face encoding (128-d or 512-d).
    Biometric templates are automatically encrypted at rest with AES-256-GCM.
    """
    service = EmployeeService(db)
    employee = await service.register_employee(employee_in)
    return employee


@router.post("/register-facenox", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED)
async def register_employee_facenox(
    request: FacenoxRegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Workflow A: Register a new employee with Facenox SOTA biometric face enrollment.
      1. Validates that Employee ID is unique.
      2. Detects face in image with OpenCV YuNet (validates exactly 1 clear face).
      3. Verifies Anti-Spoofing liveness (rejects digital photos & replays).
      4. Extracts 512-d ArcFace normalized embedding vector.
      5. Encrypts template at rest using AES-256-GCM authenticated encryption.
      6. Persists employee profile into MySQL database.
    """
    service = EmployeeService(db)
    repo = service.repo

    # 1. Check duplicate ID
    if await repo.exists_employee_id(request.employee_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Employee ID '{request.employee_id}' is already registered in the system."
        )

    # 2. Decode image
    from app.core.ai.facenox_engine import facenox_engine
    if not facenox_engine.is_ready:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Facenox AI Biometric engine is currently initializing. Please try again in a few moments."
        )

    img = facenox_engine.decode_image(request.image)
    if img is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image frame provided for face registration."
        )

    # 3. Extract embedding & validate liveness
    success, embedding, msg = await facenox_engine.extract_face_embedding(img)
    if not success or not embedding:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=msg
        )

    # 4. Create employee with encrypted 512-d template
    emp_create = EmployeeCreate(
        name=request.name.strip(),
        employee_id=request.employee_id.strip(),
        department=request.department.strip() if request.department else None,
        designation=request.designation.strip() if request.designation else None,
        work_location=request.work_location.strip() if request.work_location else None,
        email=request.email.strip() if request.email else None,
        phone=request.phone.strip() if request.phone else None,
        face_encoding=embedding
    )

    employee = await service.register_employee(emp_create)
    logger.info("Successfully registered employee %s (%s) with Facenox 512-d ArcFace template", employee.name, employee.employee_id)
    return employee


@router.post("/recognize", response_model=EmployeeRecognizeResponse)
async def recognize_employee(
    request: EmployeeRecognizeRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Recognize an employee from a base64 encoded image or face embedding.
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
    Allows administrators to unenroll or prepare for biometric re-enrollment.
    """
    service = EmployeeService(db)
    employee = await service.remove_face_encoding(employee_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee with ID '{employee_id}' not found"
        )
    return employee


@router.post("/facenox/enroll")
async def enroll_employee_facenox(
    request: FacenoxEnrollRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Enroll or re-enroll an existing employee's face using Facenox SOTA 512-d ArcFace + YuNet model.
    """
    from app.core.ai.facenox_engine import facenox_engine
    if not facenox_engine.is_ready:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Facenox AI engine not ready")

    img = facenox_engine.decode_image(request.image)
    if img is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid image data provided")
    
    success, embedding, msg = await facenox_engine.extract_face_embedding(img)
    if not success or not embedding:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=msg)
    
    repo = EmployeeService(db).repo
    emp = await repo.get_by_employee_id(request.employee_id)
    if not emp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Employee '{request.employee_id}' not found")
    
    updated = await repo.update_face_encoding(request.employee_id, embedding)
    return {
        "success": True,
        "message": f"Successfully enrolled face for {emp.name} ({request.employee_id}) using Facenox ArcFace 512-d!",
        "employee_id": request.employee_id,
        "name": emp.name,
        "embedding_dim": len(embedding),
        "is_enrolled": True
    }
