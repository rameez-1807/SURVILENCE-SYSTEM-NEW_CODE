"""
Test Neon PostgreSQL database connection.
Uses URLs from .env (SUPABASE_URL_SYNC / SUPABASE_URL).
"""
import asyncio
import asyncpg
import psycopg

from app.core.config import settings

# Strip driver prefix for raw driver connections
URL_SYNC = settings.SUPABASE_URL_SYNC.replace("postgresql+psycopg://", "postgresql://")
URL_ASYNC = settings.SUPABASE_URL.replace("postgresql+asyncpg://", "postgresql://")

def test_sync():
    try:
        conn = psycopg.connect(URL_SYNC)
        cur = conn.execute("SELECT version();")
        row = cur.fetchone()
        print(f"✅ Sync connection successful!")
        print(f"   PostgreSQL version: {row[0][:50]}")
        conn.close()
    except Exception as e:
        print(f"❌ Sync connection failed: {e}")

async def test_async():
    try:
        conn = await asyncpg.connect(URL_ASYNC, ssl="require")
        row = await conn.fetchrow("SELECT version();")
        print(f"✅ Async connection successful!")
        print(f"   PostgreSQL version: {str(row['version'])[:50]}")

        # List tables in the database
        tables = await conn.fetch(
            "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;"
        )
        print(f"\n📋 Tables in Neon DB ({len(tables)} found):")
        for t in tables:
            print(f"   - {t['tablename']}")
        await conn.close()
    except Exception as e:
        print(f"❌ Async connection failed: {e}")

if __name__ == "__main__":
    print("Testing Neon PostgreSQL connection...\n")
    test_sync()
    print()
    asyncio.run(test_async())
