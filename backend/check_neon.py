import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core.config import settings

async def test():
    engine = create_async_engine(settings.DATABASE_URL)
    async with engine.connect() as conn:
        result = await conn.execute(text("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"))
        tables = [row[0] for row in result.fetchall()]
        print("Tables in Neon PostgreSQL DB:")
        for t in tables:
            print("  -", t)

        result2 = await conn.execute(text("SELECT COUNT(*) FROM users"))
        count = result2.scalar()
        print()
        print("Total Users:", count)

        result3 = await conn.execute(text("SELECT email, is_active FROM users"))
        for row in result3.fetchall():
            print("  User:", row[0], "| Active:", row[1])

        result4 = await conn.execute(text("SELECT COUNT(*) FROM events"))
        print("Total Events:", result4.scalar())

        result5 = await conn.execute(text("SELECT COUNT(*) FROM vehicles"))
        print("Total Vehicles:", result5.scalar())

        result6 = await conn.execute(text("SELECT COUNT(*) FROM tenants"))
        print("Total Tenants:", result6.scalar())

    await engine.dispose()
    print()
    print("SUCCESS - Project is fully connected to Neon PostgreSQL!")

asyncio.run(test())
