import math
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.recognition_history import RecognitionHistoryRepository
from app.schemas.recognition_history import (
    RecognitionHistoryCreate,
    RecognitionHistoryResponse,
    RecognitionHistoryListResponse
)

import logging
logger = logging.getLogger(__name__)

class RecognitionHistoryService:
    """Service handling business logic for recognition history."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.repo = RecognitionHistoryRepository(db)

    async def log_event(self, obj_in: RecognitionHistoryCreate) -> RecognitionHistoryResponse:
        """Create a new recognition history record."""
        record = await self.repo.create(obj_in)
        logger.info(
            "Logged recognition history event: employee='%s' (%s), status='%s', confidence=%.1f%%",
            record.employee_name, record.employee_id, record.status, record.confidence
        )
        return RecognitionHistoryResponse.model_validate(record)

    async def get_history(
        self,
        employee: Optional[str] = None,
        date_str: Optional[str] = None,
        camera: Optional[str] = None,
        status: Optional[str] = None,
        page: int = 1,
        limit: int = 20
    ) -> RecognitionHistoryListResponse:
        """Retrieve paginated and filtered recognition history records."""
        items, total = await self.repo.list_paginated(
            employee=employee,
            date_str=date_str,
            camera=camera,
            status=status,
            page=page,
            limit=limit
        )

        pages = math.ceil(total / limit) if total > 0 else 1
        return RecognitionHistoryListResponse(
            items=[RecognitionHistoryResponse.model_validate(item) for item in items],
            total=total,
            page=page,
            limit=limit,
            pages=pages
        )

    async def get_dashboard_stats(
        self,
        period: str = "today",
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> RecognitionDashboardStats:
        """Fetch face recognition dashboard metrics and charts dataset."""
        from app.schemas.recognition_history import RecognitionDashboardStats
        stats = await self.repo.get_dashboard_stats(period=period, start_date=start_date, end_date=end_date)
        return RecognitionDashboardStats(
            total_registered_employees=stats["total_registered_employees"],
            recognized_faces_today=stats["recognized_faces_today"],
            unknown_faces_today=stats["unknown_faces_today"],
            attendance_marked_today=stats["attendance_marked_today"],
            trend_data=stats["trend_data"],
            distribution_data=stats["distribution_data"],
            recent_activity=[RecognitionHistoryResponse.model_validate(r) for r in stats["recent_activity"]]
        )
