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

    user_repo = UserRepository(session)
    # Eager load memberships via get_by_email, wait, get_by_id doesn't eager load.
    # Let's write a quick query to load user with memberships since we'll need it for RBAC.
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    stmt = (
        select(User)
        .where(User.id == uuid.UUID(token_data.sub))
        .options(selectinload(User.memberships))
    )
    result = await session.execute(stmt)
    user = result.scalar_one_or_none()

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
        
        # Check for platform admin first (global access)
        for membership in user.memberships:
            if membership.role == Role.PLATFORM_ADMIN:
                return user

        if not x_tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tenant context required (e.g. X-Tenant-ID header)",
            )

        # Check tenant-specific roles
        has_role = False
        for membership in user.memberships:
            if membership.tenant_id == x_tenant_id and membership.role in self.allowed_roles:
                has_role = True
                break
                
        if not has_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions",
            )
            
        return user
