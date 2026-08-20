import uuid
from datetime import datetime, timezone
import sqlalchemy as sa
from sqlalchemy import String, Float, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

class VehicleRecord(Base):
    __tablename__ = "vehicle_records"

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid(), primary_key=True, default=uuid.uuid4)
    number_plate: Mapped[str] = mapped_column(String(50), nullable=False)
    vehicle_type: Mapped[str] = mapped_column(String(50), nullable=False, default="car")
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.90)
    camera_name: Mapped[str] = mapped_column(String(100), nullable=False, default="Live ANPR Camera")
    location_spot: Mapped[str] = mapped_column(String(100), nullable=False, default="Apartment Main Gate")
    evidence_reference: Mapped[str] = mapped_column(String(255), nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
