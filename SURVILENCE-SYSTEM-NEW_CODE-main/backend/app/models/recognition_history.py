import uuid
from datetime import datetime, timezone
import sqlalchemy as sa
from sqlalchemy import String, DateTime, Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

class RecognitionHistory(Base):
    """SQLAlchemy model for face recognition events history."""
    __tablename__ = "recognition_history"

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid(), primary_key=True, default=uuid.uuid4)
    employee_uuid: Mapped[uuid.UUID | None] = mapped_column(sa.Uuid(), ForeignKey("employees.id"), nullable=True)
    
    employee_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    employee_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    camera_name: Mapped[str] = mapped_column(String(100), nullable=False, default="Live Camera")
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="Recognized")
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=lambda: datetime.now(timezone.utc),
        index=True
    )

    employee: Mapped["Employee"] = relationship("Employee", foreign_keys=[employee_uuid])
