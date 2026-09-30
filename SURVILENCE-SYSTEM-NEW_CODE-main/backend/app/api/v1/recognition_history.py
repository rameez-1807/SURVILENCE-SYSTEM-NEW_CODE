from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.services.recognition_history import RecognitionHistoryService
from app.schemas.recognition_history import (
    RecognitionHistoryCreate,
    RecognitionHistoryResponse,
    RecognitionHistoryListResponse,
    RecognitionDashboardStats
)

router = APIRouter(prefix="/recognition-history", tags=["Recognition History"])

@router.get("/stats", response_model=RecognitionDashboardStats)
async def get_recognition_dashboard_stats(
    period: str = Query("today", description="Time period: today, 7days, 30days, custom"),
    start_date: Optional[str] = Query(None, description="Start date for custom period (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date for custom period (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve aggregated stats, chart dataset, and recent activity for the Face Recognition Dashboard."""
    service = RecognitionHistoryService(db)
    return await service.get_dashboard_stats(period=period, start_date=start_date, end_date=end_date)

@router.get("", response_model=RecognitionHistoryListResponse)
async def get_recognition_history(
    employee: Optional[str] = Query(None, description="Search employee name or ID"),
    date: Optional[str] = Query(None, description="Filter date in YYYY-MM-DD format"),
    camera: Optional[str] = Query(None, description="Filter camera name"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status (Recognized/Unknown)"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve filtered and paginated face recognition history logs."""
    service = RecognitionHistoryService(db)
    return await service.get_history(
        employee=employee,
        date_str=date,
        camera=camera,
        status=status_filter,
        page=page,
        limit=limit
    )

@router.post("", response_model=RecognitionHistoryResponse, status_code=status.HTTP_201_CREATED)
async def create_recognition_history_event(
    event_in: RecognitionHistoryCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new face recognition history event."""
    service = RecognitionHistoryService(db)
    return await service.log_event(event_in)
