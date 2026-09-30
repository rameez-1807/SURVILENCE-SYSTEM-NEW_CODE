import math
import uuid
from datetime import datetime
from typing import Optional, Sequence
import sqlalchemy as sa
from sqlalchemy import select, func, desc, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.recognition_history import RecognitionHistory
from app.schemas.recognition_history import RecognitionHistoryCreate

class RecognitionHistoryRepository:
    """Repository for managing recognition_history table operations."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, obj_in: RecognitionHistoryCreate) -> RecognitionHistory:
        """Create a new recognition history record and commit."""
        record = RecognitionHistory(
            employee_uuid=obj_in.employee_uuid,
            employee_id=obj_in.employee_id,
            employee_name=obj_in.employee_name,
            confidence=obj_in.confidence,
            camera_name=obj_in.camera_name,
            status=obj_in.status
        )
        self.db.add(record)
        await self.db.commit()
        await self.db.refresh(record)
        return record

    async def list_paginated(
        self,
        employee: Optional[str] = None,
        date_str: Optional[str] = None,
        camera: Optional[str] = None,
        status: Optional[str] = None,
        page: int = 1,
        limit: int = 20
    ) -> tuple[Sequence[RecognitionHistory], int]:
        """Fetch filtered and paginated recognition history records."""
        stmt = select(RecognitionHistory)

        # Filters
        if employee:
            search_pattern = f"%{employee.strip()}%"
            stmt = stmt.where(
                or_(
                    RecognitionHistory.employee_id.ilike(search_pattern),
                    RecognitionHistory.employee_name.ilike(search_pattern)
                )
            )

        if date_str:
            try:
                dt = datetime.strptime(date_str, "%Y-%m-%d")
                start_dt = dt.replace(hour=0, minute=0, second=0, microsecond=0)
                end_dt = dt.replace(hour=23, minute=59, second=59, microsecond=999999)
                stmt = stmt.where(
                    sa.and_(
                        RecognitionHistory.timestamp >= start_dt,
                        RecognitionHistory.timestamp <= end_dt
                    )
                )
            except ValueError:
                pass

        if camera:
            stmt = stmt.where(RecognitionHistory.camera_name.ilike(f"%{camera.strip()}%"))

        if status:
            stmt = stmt.where(RecognitionHistory.status.ilike(status.strip()))

        # Total count query
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_result = await self.db.execute(count_stmt)
        total = total_result.scalar_one_or_none() or 0

        # Pagination & Ordering (latest records first)
        offset = (page - 1) * limit
        stmt = stmt.order_by(desc(RecognitionHistory.timestamp)).offset(offset).limit(limit)
        
        result = await self.db.execute(stmt)
        items = result.scalars().all()

        return items, total

    async def get_dashboard_stats(
        self,
        period: str = "today",
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> dict:
        """Calculate aggregated KPI metrics, timeline trends, and identity distribution."""
        from datetime import date as date_cls, timedelta, timezone as tz
        from app.models.employee import Employee
        from app.models.attendance import AttendanceRecord

        today_d = datetime.now(tz.utc).date()
        today_str = str(today_d)

        # 1. Total Registered Employees
        total_emp_stmt = select(func.count()).select_from(Employee)
        total_employees = (await self.db.execute(total_emp_stmt)).scalar_one_or_none() or 0

        # 2. Attendance Marked Today
        att_stmt = select(func.count()).select_from(AttendanceRecord).where(AttendanceRecord.date == today_d)
        attendance_today = (await self.db.execute(att_stmt)).scalar_one_or_none() or 0

        # 3. Faces Recognized Today
        rec_today_stmt = select(func.count()).select_from(RecognitionHistory).where(
            sa.and_(
                func.date(RecognitionHistory.timestamp) == today_str,
                RecognitionHistory.status == "Recognized"
            )
        )
        recognized_today = (await self.db.execute(rec_today_stmt)).scalar_one_or_none() or 0

        # 4. Unknown Faces Today
        unk_today_stmt = select(func.count()).select_from(RecognitionHistory).where(
            sa.and_(
                func.date(RecognitionHistory.timestamp) == today_str,
                RecognitionHistory.status == "Unknown"
            )
        )
        unknown_today = (await self.db.execute(unk_today_stmt)).scalar_one_or_none() or 0

        # Fetch window records based on period
        window_stmt = select(RecognitionHistory)

        if period == "7days":
            min_d_str = str(today_d - timedelta(days=7))
            window_stmt = window_stmt.where(func.date(RecognitionHistory.timestamp) >= min_d_str)
        elif period == "30days":
            min_d_str = str(today_d - timedelta(days=30))
            window_stmt = window_stmt.where(func.date(RecognitionHistory.timestamp) >= min_d_str)
        elif period == "custom" and start_date and end_date:
            window_stmt = window_stmt.where(
                sa.and_(
                    func.date(RecognitionHistory.timestamp) >= start_date,
                    func.date(RecognitionHistory.timestamp) <= end_date
                )
            )
        else:
            # Default "today"
            window_stmt = window_stmt.where(func.date(RecognitionHistory.timestamp) == today_str)

        window_stmt = window_stmt.order_by(desc(RecognitionHistory.timestamp))
        window_records = (await self.db.execute(window_stmt)).scalars().all()

        # Build Trend Data Timeline
        trend_map: dict[str, dict[str, int]] = {}
        if period == "today":
            # Hourly breakdown for today
            for h in range(8, 20, 2):
                h_str = f"{h:02d}:00"
                trend_map[h_str] = {"recognized": 0, "unknown": 0}

            for r in window_records:
                h_key = f"{r.timestamp.hour:02d}:00"
                if h_key not in trend_map:
                    trend_map[h_key] = {"recognized": 0, "unknown": 0}
                if r.status == "Recognized":
                    trend_map[h_key]["recognized"] += 1
                else:
                    trend_map[h_key]["unknown"] += 1
        else:
            # Daily breakdown for 7/30 days
            for r in window_records:
                d_key = r.timestamp.strftime("%b %d")
                if d_key not in trend_map:
                    trend_map[d_key] = {"recognized": 0, "unknown": 0}
                if r.status == "Recognized":
                    trend_map[d_key]["recognized"] += 1
                else:
                    trend_map[d_key]["unknown"] += 1

        trend_data = [{"time": k, "recognized": v["recognized"], "unknown": v["unknown"]} for k, v in trend_map.items()]

        # Distribution Chart Data
        total_rec_in_window = sum(1 for r in window_records if r.status == "Recognized")
        total_unk_in_window = sum(1 for r in window_records if r.status == "Unknown")

        distribution_data = [
          {"name": "Recognized Faces", "count": total_rec_in_window, "fill": "#10B981"},
          {"name": "Unknown Faces", "count": total_unk_in_window, "fill": "#EF4444"}
        ]

        # Recent Activity (latest 10)
        recent_activity = window_records[:10]

        return {
            "total_registered_employees": total_employees,
            "recognized_faces_today": recognized_today,
            "unknown_faces_today": unknown_today,
            "attendance_marked_today": attendance_today,
            "trend_data": trend_data,
            "distribution_data": distribution_data,
            "recent_activity": recent_activity
        }
