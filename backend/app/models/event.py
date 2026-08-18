import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, Float, ForeignKey, String, DateTime, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import Base


class Event(Base):
    __tablename__ = "events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    site_id = Column(UUID(as_uuid=True), ForeignKey("sites.id", ondelete="CASCADE"), nullable=False)
    camera_id = Column(UUID(as_uuid=True), ForeignKey("cameras.id", ondelete="CASCADE"), nullable=False)
    rule_id = Column(UUID(as_uuid=True), ForeignKey("rules.id", ondelete="SET NULL"), nullable=True)

    event_type = Column(String, nullable=False)
    severity = Column(String, nullable=False, default="low") # low, medium, high, critical
    state = Column(String, nullable=False, default="OPEN") # OPEN, ACKNOWLEDGED, ASSIGNED, CLOSED
    
    observed_at = Column(DateTime(timezone=True), nullable=False)
    confidence = Column(Float, nullable=False, default=0.0)
    
    model_id = Column(String, nullable=False)
    model_version = Column(String, nullable=False)
    
    evidence_reference = Column(String, nullable=True)
    dedupe_key = Column(String, nullable=False)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    tenant = relationship("Tenant")
    site = relationship("Site")
    camera = relationship("Camera")
    rule = relationship("Rule")

    __table_args__ = (
        UniqueConstraint('tenant_id', 'dedupe_key', name='uq_event_tenant_dedupe'),
        Index('ix_events_tenant_id', 'tenant_id'),
        Index('ix_events_site_id', 'site_id'),
        Index('ix_events_camera_id', 'camera_id'),
        Index('ix_events_observed_at', 'observed_at'),
        Index('ix_events_event_type', 'event_type'),
        Index('ix_events_state', 'state'),
    )


class EventAudit(Base):
    __tablename__ = "event_audits"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    previous_state = Column(String, nullable=False)
    new_state = Column(String, nullable=False)
    
    reason = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    event = relationship("Event", backref="audits")
    user = relationship("User")

    __table_args__ = (
        Index('ix_event_audits_event_id', 'event_id'),
    )
