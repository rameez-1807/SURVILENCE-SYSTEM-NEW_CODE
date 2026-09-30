"""AI Surveillance System - Schemas Module."""

from app.schemas.health import HealthResponse
from app.schemas.tenant import (
    TenantCreate,
    TenantListResponse,
    TenantResponse,
    TenantUpdate,
)
from app.schemas.site import (
    SiteCreate,
    SiteListResponse,
    SiteResponse,
    SiteUpdate,
)
from app.schemas.auth import Token, TokenData
from app.schemas.user import UserCreate, UserResponse, MembershipResponse
from app.schemas.camera import (
    CameraCreate,
    CameraUpdate,
    CameraResponse,
    CameraListResponse,
    CameraHealthResponse,
    PreviewTokenResponse
)

__all__ = [
    "HealthResponse",
    "TenantCreate",
    "TenantListResponse",
    "TenantResponse",
    "TenantUpdate",
    "SiteCreate",
    "SiteListResponse",
    "SiteResponse",
    "SiteUpdate",
    "Token",
    "TokenData",
    "UserCreate",
    "UserResponse",
    "MembershipResponse",
    "CameraCreate",
    "CameraUpdate",
    "CameraResponse",
    "CameraListResponse",
    "CameraHealthResponse",
    "PreviewTokenResponse",
]
