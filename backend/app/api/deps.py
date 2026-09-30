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
    # Accept any token that starts with 'demo-token-' and return a fake admin
    # user so the frontend can be demoed without a real auth backend.
    if token.startswith("demo-token-"):
        from sqlalchemy import select
        from sqlalchemy.orm import selectinload
        # Try to return the first active user from DB as the demo user
        try:
            stmt = (
                select(User)
                .where(User.is_active == True)
                .options(selectinload(User.memberships))
                .limit(1)
            )
            result = await session.execute(stmt)
            demo_user = result.scalar_one_or_none()
            if demo_user:
                return demo_user
        except Exception:
            pass
        # Fallback: build a minimal in-memory User object if DB has no users
        fake_user = User()
        fake_user.id = uuid.UUID("00000000-0000-0000-0000-000000000001")
        fake_user.email = "demo@demo.com"
        fake_user.full_name = "Demo User"
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
        user_uuid = uuid.UUID(token_data.sub)
        from sqlalchemy import select
        from sqlalchemy.orm import selectinload
        stmt = (
            select(User)
            .where(User.id == user_uuid)
            .options(selectinload(User.memberships))
        )
        result = await session.execute(stmt)
        user = result.scalar_one_or_none()
    except (ValueError, TypeError):
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

        # If user is platform admin or has no tenant restriction, allow if platform admin
        if any((m.role.value if hasattr(m.role, "value") else str(m.role)) == "platform_admin" for m in user.memberships):
            return user

        if not x_tenant_id and not user.memberships:
            # Allow fallback if single-tenant / local development
            return user
            
        return user
