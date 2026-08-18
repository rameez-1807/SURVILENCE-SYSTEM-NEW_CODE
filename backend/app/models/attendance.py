import uuid
from datetime import date, time
from sqlalchemy import String, Date, Time, Float, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_uuid: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id"), nullable=False)
    
    date: Mapped[date] = mapped_column(Date, nullable=False)
    first_seen: Mapped[time] = mapped_column(Time, nullable=False)
    last_seen: Mapped[time] = mapped_column(Time, nullable=False)
    camera_name: Mapped[str] = mapped_column(String(100), nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)

    employee: Mapped["Employee"] = relationship("Employee", foreign_keys=[employee_uuid])
