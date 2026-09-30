"""
AI Surveillance System - Camera Model

SQLAlchemy model for cameras.
Links a camera to a specific Site and Tenant.
"""

import enum
import uuid
from datetime import datetime, timezone

import sqlalchemy as sa
from sqlalchemy import DateTime, Enum, ForeignKey, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class CameraStatus(str, enum.Enum):
    """Status states for a camera."""
    PENDING_TEST = "pending_test"
    ACTIVE = "active"
    OFFLINE = "offline"
    ERROR = "error"


class Camera(Base):
    """Database model for a surveillance camera."""

    __tablename__ = "cameras"

    id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid(),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid(),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    site_id: Mapped[uuid.UUID] = mapped_column(
        sa.Uuid(),
        ForeignKey("sites.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    protocol: Mapped[str] = mapped_column(String(50), nullable=False, default="rtsp")
    host: Mapped[str] = mapped_column(String(255), nullable=False)
    stream_path: Mapped[str] = mapped_column(String(255), nullable=False)
    credential_reference: Mapped[str | None] = mapped_column(String(255), nullable=True)
    stream_profile: Mapped[str | None] = mapped_column(String(100), nullable=True)
    timezone: Mapped[str] = mapped_column(String(50), nullable=False, default="UTC")
    status: Mapped[CameraStatus] = mapped_column(
        Enum(CameraStatus, name="camera_status_enum", create_constraint=True, values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
        default=CameraStatus.PENDING_TEST,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=text("now()"),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        server_default=text("now()"),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    tenant = relationship("Tenant", lazy="selectin", overlaps="cameras,sites")
    site = relationship("Site", lazy="selectin", overlaps="cameras,tenant")

    def __repr__(self) -> str:
        return f"<Camera(id={self.id}, name='{self.name}', status='{self.status}')>"
