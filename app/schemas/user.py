"""
AI Surveillance System - User Schemas

Schemas for user creation, updating, and responses.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.membership import Role


# ---------------------------------------------------------------------------
# Memberships
# ---------------------------------------------------------------------------

class MembershipResponse(BaseModel):
    """Schema for a user's membership in a tenant."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID | None
    role: Role
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Requests
# ---------------------------------------------------------------------------

class UserCreate(BaseModel):
    """Schema for creating a new user."""
    email: EmailStr
    password: str = Field(..., min_length=8, description="Plain text password.")


# ---------------------------------------------------------------------------
# Responses
# ---------------------------------------------------------------------------

class UserResponse(BaseModel):
    """Schema for returning a user safely (without password hash)."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    is_active: bool
    created_at: datetime
    updated_at: datetime
    memberships: list[MembershipResponse] = []
