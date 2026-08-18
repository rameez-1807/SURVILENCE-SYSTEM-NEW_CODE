"""
AI Surveillance System - Site Pydantic Schemas

Request/response schemas for the Site API.
"""

import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

import json


# ---------------------------------------------------------------------------
# Address sub-schema
# ---------------------------------------------------------------------------

class AddressSchema(BaseModel):
    """Optional structured address for a site."""
    street: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    country: Optional[str] = None


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class SiteCreate(BaseModel):
    """Schema for creating a new site."""
    tenant_id: uuid.UUID = Field(
        ...,
        description="UUID of the tenant that owns this site.",
    )
    name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Site name.",
        examples=["Headquarters"],
    )
    timezone: str = Field(
        default="UTC",
        max_length=64,
        description="IANA timezone identifier.",
        examples=["America/New_York"],
    )
    address_json: Optional[AddressSchema] = Field(
        default=None,
        description="Structured address object.",
    )


class SiteUpdate(BaseModel):
    """Schema for partially updating a site (PATCH)."""
    name: Optional[str] = Field(
        default=None,
        min_length=1,
        max_length=255,
        description="New site name.",
    )
    timezone: Optional[str] = Field(
        default=None,
        max_length=64,
        description="New IANA timezone identifier.",
    )
    address_json: Optional[AddressSchema] = Field(
        default=None,
        description="New structured address object.",
    )


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class SiteResponse(BaseModel):
    """Schema returned for a single site."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    timezone: str
    address_json: Optional[Any] = None
    created_at: datetime
    updated_at: datetime

    @field_validator("address_json", mode="before")
    @classmethod
    def parse_address_json(cls, v: Any) -> Any:
        """Deserialise the JSON string stored in the DB into a dict."""
        if isinstance(v, str):
            try:
                return json.loads(v)
            except (json.JSONDecodeError, TypeError):
                return v
        return v


class SiteListResponse(BaseModel):
    """Schema returned for a list of sites."""
    items: list[SiteResponse]
    total: int
