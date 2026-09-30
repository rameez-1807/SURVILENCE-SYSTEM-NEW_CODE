"""Check what tables exist in Supabase."""
import sys
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, ".")

from app.core.config import settings
import psycopg

url = settings.SUPABASE_DB_URL_SYNC.replace("postgresql+psycopg://", "postgresql://")
conn = psycopg.connect(url)
cur = conn.execute(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;"
)
rows = cur.fetchall()
conn.close()

print(f"Tables in Supabase ({len(rows)}):")
if rows:
    for r in rows:
        print(f"  - {r[0]}")
else:
    print("  (EMPTY - No tables found!)")
    print("\n  You need to run migrations first:")
    print("  alembic upgrade head")
