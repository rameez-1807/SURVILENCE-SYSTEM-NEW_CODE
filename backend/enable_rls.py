"""
Enable Row Level Security (RLS) on all public tables in Supabase.

Policies:
- service_role: Full access (used by backend supabase-py admin client)
- authenticated: Full access (logged-in users via Supabase Auth)
- anon (public): NO access (blocks unauthorized API access)

Note: Direct PostgreSQL connections via the `postgres` user (SQLAlchemy)
bypass RLS automatically since postgres is a superuser.
"""
import sys
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, ".")

from app.core.config import settings
import psycopg

# Tables to protect (all public tables except alembic_version which is internal)
TABLES = [
    "tenants",
    "sites",
    "users",
    "memberships",
    "cameras",
    "employees",
    "attendance_records",
    "events",
    "event_audits",
    "rules",
    "vehicle_records",
    "recognition_history",
    "detection_zones",
]

# alembic_version is internal — just enable RLS with no public access
INTERNAL_TABLES = ["alembic_version"]


def enable_rls():
    url = settings.SUPABASE_DB_URL_SYNC.replace("postgresql+psycopg://", "postgresql://")
    conn = psycopg.connect(url)
    conn.autocommit = True

    print("=" * 60)
    print("Enabling Row Level Security (RLS) on all tables")
    print("=" * 60)

    # --- Enable RLS + policies on app tables ---
    for table in TABLES:
        print(f"\n[{table}]")

        # 1. Enable RLS
        conn.execute(f"ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY;")
        print(f"  RLS enabled")

        # 2. Drop existing policies (if any) to avoid conflicts
        existing = conn.execute(
            "SELECT policyname FROM pg_policies WHERE tablename = %s AND schemaname = 'public';",
            (table,)
        ).fetchall()
        for (policy_name,) in existing:
            conn.execute(f'DROP POLICY IF EXISTS "{policy_name}" ON public.{table};')
            print(f"  Dropped old policy: {policy_name}")

        # 3. Policy: service_role gets full access (for backend admin operations)
        conn.execute(f"""
            CREATE POLICY "service_role_full_access" ON public.{table}
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
        """)
        print(f"  + service_role: full access")

        # 4. Policy: authenticated users get full access (for Supabase Auth users)
        conn.execute(f"""
            CREATE POLICY "authenticated_full_access" ON public.{table}
            FOR ALL
            TO authenticated
            USING (true)
            WITH CHECK (true);
        """)
        print(f"  + authenticated: full access")

        # 5. No policy for anon = anon has NO access (blocked by default with RLS)
        print(f"  x anon: blocked (no policy)")

    # --- Internal tables: RLS only, no access ---
    for table in INTERNAL_TABLES:
        print(f"\n[{table}] (internal)")
        conn.execute(f"ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY;")

        # Only service_role can access
        existing = conn.execute(
            "SELECT policyname FROM pg_policies WHERE tablename = %s AND schemaname = 'public';",
            (table,)
        ).fetchall()
        for (policy_name,) in existing:
            conn.execute(f'DROP POLICY IF EXISTS "{policy_name}" ON public.{table};')

        conn.execute(f"""
            CREATE POLICY "service_role_only" ON public.{table}
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
        """)
        print(f"  RLS enabled (service_role only)")

    conn.close()

    print("\n" + "=" * 60)
    print("DONE! RLS enabled on all tables.")
    print("=" * 60)
    print("\nSummary:")
    print(f"  - {len(TABLES)} app tables: service_role + authenticated = full access, anon = blocked")
    print(f"  - {len(INTERNAL_TABLES)} internal tables: service_role only")
    print(f"  - Direct postgres (SQLAlchemy) connections bypass RLS (superuser)")


if __name__ == "__main__":
    enable_rls()
