"""
AI Surveillance System - Membership Model

SQLAlchemy model for linking Users to Tenants with specific roles.
This enables Tenant-aware Role-Based Access Control (RBAC).
"""

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Role(str, enum.Enum):
    """Supported roles in the RBAC system."""
    OPERATOR = "operator"
    SUPERVISOR = "supervisor"
    INSTALLER = "installer"
    OEM_ADMIN = "oem_admin"
    PLATFORM_ADMIN = "platform_admin"


class Membership(Base):
    """Links a user to a tenant and defines their role."""

    __tablename__ = "memberships"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=True,  # Can be null for platform_admins
        index=True,
    )
    role: Mapped[Role] = mapped_column(
        Enum(Role, name="role_enum", create_constraint=True, values_callable=lambda obj: [e.value for e in obj]),
        nullable=False,
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
    user = relationship("User", back_populates="memberships")
    tenant = relationship("Tenant", lazy="selectin")

    def __repr__(self) -> str:
        return f"<Membership(id={self.id}, user_id={self.user_id}, tenant_id={self.tenant_id}, role='{self.role}')>"
