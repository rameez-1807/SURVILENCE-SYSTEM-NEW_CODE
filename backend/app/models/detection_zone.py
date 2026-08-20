"""
AI Surveillance System - Detection Zone Model

SQLAlchemy model for camera-specific Regions of Interest (ROI) and security zones.
Supports polygon coordinates, zone types (restricted, entrance, parking, loiter),
and alert triggers.
"""

import uuid
from datetime import datetime, timezone
import sqlalchemy as sa
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, JSON, String
from sqlalchemy.orm import relationship

from app.db.base import Base


class DetectionZone(Base):
    __tablename__ = "detection_zones"

    id = Column(sa.Uuid(), primary_key=True, default=uuid.uuid4)
    camera_id = Column(sa.Uuid(), ForeignKey("cameras.id", ondelete="CASCADE"), nullable=False)
    tenant_id = Column(sa.Uuid(), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    site_id = Column(sa.Uuid(), ForeignKey("sites.id", ondelete="CASCADE"), nullable=True)

    name = Column(String(100), nullable=False)
    zone_type = Column(String(50), nullable=False, default="restricted")  # restricted, entrance, parking, loitering
    polygon_points = Column(JSON, nullable=False)  # [[x1, y1], [x2, y2], ...] normalized [0, 1]

    enabled = Column(Boolean, nullable=False, default=True)
    alert_on_entry = Column(Boolean, nullable=False, default=True)
    alert_on_loiter = Column(Boolean, nullable=False, default=False)
    loiter_seconds = Column(Integer, nullable=False, default=30)
    severity = Column(String(20), nullable=False, default="medium")  # low, medium, high, critical

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    camera = relationship("Camera")
    tenant = relationship("Tenant")
    site = relationship("Site")

    __table_args__ = (
        Index("ix_detection_zones_camera_id", "camera_id"),
        Index("ix_detection_zones_tenant_id", "tenant_id"),
    )
