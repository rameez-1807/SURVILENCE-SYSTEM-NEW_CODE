"""
AI Surveillance System - Tenant Pydantic Schemas

Request/response schemas for the Tenant API.
"""

import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class TenantStatus(str, Enum):
    """Allowed tenant statuses (mirrors the DB enum)."""
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class TenantCreate(BaseModel):
    """Schema for creating a new tenant."""
    name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Unique tenant name.",
        examples=["Acme Corp"],
    )
    status: TenantStatus = Field(
        default=TenantStatus.ACTIVE,
        description="Initial tenant status.",
    )


class TenantUpdate(BaseModel):
    """Schema for partially updating a tenant (PATCH)."""
    name: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=255,
        description="New tenant name.",
    )
    status: Optional[TenantStatus] = Field(
        default=None,
        description="New tenant status.",
    )


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class TenantResponse(BaseModel):
    """Schema returned for a single tenant."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    status: TenantStatus
    created_at: datetime
    updated_at: datetime


class TenantListResponse(BaseModel):
    """Schema returned for a list of tenants."""
    items: list[TenantResponse]
    total: int
