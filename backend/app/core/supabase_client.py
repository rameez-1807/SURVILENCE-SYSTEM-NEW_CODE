"""
AI Surveillance System - Supabase Client

Provides a configured Supabase client for interacting with
Supabase services (Auth, Database, Storage, Realtime, etc.)
from the Python/FastAPI backend.
"""

from supabase import create_client, Client

from app.core.config import settings


def get_supabase_client() -> Client:
    """
    Create and return a Supabase client using the publishable (anon) key.

    Use this for operations that respect Row Level Security (RLS).
    Suitable for user-facing API routes.
    """
    if not settings.SUPABASE_URL or not settings.SUPABASE_PUBLISHABLE_KEY:
        raise RuntimeError(
            "Missing Supabase environment variables. "
            "Please set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in your .env file."
        )
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_PUBLISHABLE_KEY)


def get_supabase_admin_client() -> Client:
    """
    Create and return a Supabase client using the secret (service_role) key.

    WARNING: This client BYPASSES Row Level Security (RLS).
    Use only for admin/backend operations (e.g., user management,
    background jobs, migrations).
    """
    if not settings.SUPABASE_URL or not settings.SUPABASE_SECRET_KEY:
        raise RuntimeError(
            "Missing Supabase environment variables. "
            "Please set SUPABASE_URL and SUPABASE_SECRET_KEY in your .env file."
        )
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SECRET_KEY)


# Singleton instances (created on first import)
supabase: Client = get_supabase_client()
supabase_admin: Client = get_supabase_admin_client()
