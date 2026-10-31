"""
AI Surveillance System - API Dependencies

Reusable FastAPI dependencies for authentication and authorization.
"""

import uuid
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status, Header
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import ValidationError

from app.core.config import settings
from app.db.session import get_db
from app.models.membership import Role
from app.models.user import User
from app.repositories.user import UserRepository
from app.schemas.auth import TokenData

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/token"
)

SessionDep = Annotated[AsyncSession, Depends(get_db)]
TokenDep = Annotated[str, Depends(oauth2_scheme)]


async def get_current_user(
    session: SessionDep, token: TokenDep
) -> User:
    """Validate JWT token and return the current user."""

    # ── DEMO MODE ────────────────────────────────────────────────────────────
    # Gate demo mode strictly behind explicit environment flags.
    # NEVER allow in production or by default.
    if token.startswith("demo-token-"):
        if not (settings.DEBUG and getattr(settings, "ENABLE_DEMO_AUTH", False)):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Demo authentication tokens are rejected. Valid authentication required.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        # Even when explicitly enabled in local dev, return a restricted demo user (never real platform_admin)
        fake_user = User()
        fake_user.id = uuid.UUID("00000000-0000-0000-0000-000000000001")
        fake_user.email = "demo@surveillance.local"
        setattr(fake_user, "full_name", "Restricted Demo User")
        fake_user.is_active = True
        fake_user.memberships = []
        return fake_user
    # ── END DEMO MODE ────────────────────────────────────────────────────────

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        token_data = TokenData(sub=user_id)
    except (jwt.InvalidTokenError, ValidationError):
        raise credentials_exception

    try:
        from app.db.base import parse_safe_uuid
        user_uuid = parse_safe_uuid(token_data.sub)
        from sqlalchemy import select
        from sqlalchemy.orm import selectinload
        try:
            stmt = (
                select(User)
                .where(User.id == user_uuid)
                .options(selectinload(User.memberships))
            )
            result = await session.execute(stmt)
            user = result.scalar_one_or_none()
        except Exception:
            stmt = select(User).where(User.id == user_uuid)
            result = await session.execute(stmt)
            user = result.scalar_one_or_none()
            if user and not hasattr(user, "memberships"):
                user.memberships = []
    except Exception:
        raise credentials_exception

    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


class RoleChecker:
    """Dependency class to check if a user has required roles for a specific tenant.
    
    Expects 'X-Tenant-ID' header or 'tenant_id' in path/query params.
    """
    def __init__(self, allowed_roles: list[Role]):
        self.allowed_roles = allowed_roles

    def __call__(
        self,
        user: CurrentUser,
        x_tenant_id: Annotated[uuid.UUID | None, Header(alias="X-Tenant-ID")] = None,
    ) -> User:
        """Validate the user has one of the allowed roles."""
        
        allowed_values = {r.value if hasattr(r, "value") else str(r) for r in self.allowed_roles}
        allowed_values.add(Role.PLATFORM_ADMIN.value)

        # Check for platform admin or allowed tenant roles
        for membership in user.memberships:
            m_role_str = membership.role.value if hasattr(membership.role, "value") else str(membership.role)
            if m_role_str == Role.PLATFORM_ADMIN.value:
                return user
            if x_tenant_id and str(membership.tenant_id) == str(x_tenant_id) and m_role_str in allowed_values:
                return user

        if not x_tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="X-Tenant-ID header is required",
            )

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient role privileges for this tenant",
        )
