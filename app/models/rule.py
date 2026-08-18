import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, Float, ForeignKey, String, DateTime, Index, Boolean, Integer, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import Base


class Rule(Base):
    __tablename__ = "rules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    site_id = Column(UUID(as_uuid=True), ForeignKey("sites.id", ondelete="CASCADE"), nullable=True)
    
    name = Column(String, nullable=False)
    enabled = Column(Boolean, nullable=False, default=True)
    detection_class = Column(String, nullable=False) # e.g., "person", "vehicle"
    confidence_threshold = Column(Float, nullable=False, default=0.5)
    
    zone_configuration = Column(JSON, nullable=True) # E.g., list of polygons
    schedule_configuration = Column(JSON, nullable=True) # E.g., time windows
    
    severity = Column(String, nullable=False, default="medium")
    version = Column(Integer, nullable=False, default=1)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    tenant = relationship("Tenant")
    site = relationship("Site")

    __table_args__ = (
        Index('ix_rules_tenant_id', 'tenant_id'),
        Index('ix_rules_site_id', 'site_id'),
    )
