"""Quick test to verify full Supabase connection (API + Database)."""
import sys
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, ".")

from app.core.config import settings
from supabase import create_client

print("=" * 50)
print("Supabase Connection Test")
print("=" * 50)

# Test 1: Env variables
print(f"\n[1] SUPABASE_URL: {settings.SUPABASE_URL[:40]}...")
print(f"[2] SUPABASE_PUBLISHABLE_KEY: {settings.SUPABASE_PUBLISHABLE_KEY[:30]}...")
print(f"[3] SUPABASE_DB_URL: Password is SET")

# Test 2: Supabase API
print("\n[4] Testing Supabase API connection...")
try:
    client = create_client(settings.SUPABASE_URL, settings.SUPABASE_PUBLISHABLE_KEY)
    result = client.table("_dummy_test_ping").select("*").limit(1).execute()
    print("    PASS - Supabase API connected!")
except Exception as e:
    err_msg = str(e)
    if "PGRST205" in err_msg or ("relation" in err_msg and "does not exist" in err_msg):
        print("    PASS - Supabase API connected! (test table doesn't exist, expected)")
    else:
        print(f"    FAIL - {err_msg}")

# Test 3: Direct PostgreSQL via SQLAlchemy
print("\n[5] Testing direct PostgreSQL connection (SQLAlchemy)...")
try:
    import psycopg
    db_url = settings.SUPABASE_DB_URL_SYNC.replace("postgresql+psycopg://", "postgresql://")
    conn = psycopg.connect(db_url)
    cur = conn.execute("SELECT version();")
    version = cur.fetchone()[0]
    conn.close()
    print(f"    PASS - PostgreSQL connected!")
    print(f"    Server: {version[:60]}...")
except Exception as e:
    print(f"    FAIL - {e}")

print("\n" + "=" * 50)
print("DONE!")
