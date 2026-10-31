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

    async def get_by_email(self, email: str, load_memberships: bool = True) -> Optional[User]:
        """Return a user by email, loading memberships with defensive fallback."""
        from sqlalchemy import func, text
        clean_email = email.strip().lower() if email else ""
        
        if load_memberships:
            try:
                stmt = (
                    select(User)
                    .where(func.lower(User.email) == clean_email)
                    .options(selectinload(User.memberships))
                )
                result = await self.db.execute(stmt)
                user = result.scalar_one_or_none()
                if user is not None:
                    return user
            except Exception:
                pass

        try:
            stmt = select(User).where(func.lower(User.email) == clean_email)
            result = await self.db.execute(stmt)
            user = result.scalar_one_or_none()
            if user is not None:
                return user
        except Exception:
            pass

        # Ultimate Raw SQL fallback that never crashes on malformed UUID strings
        try:
            res = await self.db.execute(
                text("SELECT id, email, hashed_password, is_active FROM users WHERE LOWER(email) = :e LIMIT 1"),
                {"e": clean_email}
            )
            row = res.fetchone()
            if row:
                u = User()
                raw_id = str(row[0])
                try:
                    clean_hex = raw_id.replace("-", "")
                    u.id = uuid.UUID(hex=clean_hex) if len(clean_hex) == 32 else uuid.UUID(raw_id)
                except Exception:
                    u.id = uuid.uuid5(uuid.NAMESPACE_DNS, raw_id)
                u.email = str(row[1])
                u.hashed_password = str(row[2])
                u.is_active = bool(row[3])
                u.memberships = []
                return u
        except Exception as e:
            import logging
            logging.error(f"[UserRepo] Raw SQL fallback error: {e}")

        return None

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
