"""
AI Surveillance System - User Repository

Data access layer for users and memberships.
"""

import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.membership import Membership
from app.models.user import User


class UserRepository:
    """Repository that encapsulates user database operations."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(self, user_id: uuid.UUID) -> Optional[User]:
        """Return a user by ID."""
        stmt = select(User).where(User.id == user_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> Optional[User]:
        """Return a user by email, loading memberships."""
        stmt = (
            select(User)
            .where(User.email == email)
            .options(selectinload(User.memberships))
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def create(self, user: User) -> User:
        """Insert a new user and return it."""
        self.db.add(user)
        await self.db.flush()
        await self.db.refresh(user)
        return user

    async def add_membership(self, membership: Membership) -> Membership:
        """Add a role membership for a user."""
        self.db.add(membership)
        await self.db.flush()
        await self.db.refresh(membership)
        return membership
