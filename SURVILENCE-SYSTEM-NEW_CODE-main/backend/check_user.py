import asyncio
from app.db.session import async_session_factory
from app.models.user import User
from sqlalchemy import select
from sqlalchemy.orm import selectinload

async def check_user():
    async with async_session_factory() as session:
        result = await session.execute(
            select(User)
            .where(User.email == 'admin@example.com')
            .options(selectinload(User.memberships))
        )
        user = result.scalar_one_or_none()
        print('User:', user.email)
        print('Memberships:', user.memberships)

asyncio.run(check_user())
