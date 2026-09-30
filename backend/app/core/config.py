"""
AI Surveillance System - Core Configuration

Manages all application settings using Pydantic Settings.
Environment variables are loaded from .env file.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Application
    APP_NAME: str = "AI Surveillance System"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False

    # AI Face Recognition Threshold (Max Euclidean Distance)
    FACE_RECOGNITION_THRESHOLD: float = 0.55
    LOG_UNKNOWN_RECOGNITIONS: bool = False

    # Database
    DATABASE_HOST: str = "localhost"
    DATABASE_PORT: int = 5432
    DATABASE_USER: str = "postgres"
    DATABASE_PASSWORD: str = "postgres"
    DATABASE_NAME: str = "ai_surveillance"
    # Supabase API (for supabase-py client)
    SUPABASE_URL: str = ""
    SUPABASE_PUBLISHABLE_KEY: str = ""
    SUPABASE_SECRET_KEY: str = ""
    SUPABASE_JWKS_URL: str = ""
    # Supabase Direct DB Connection (for SQLAlchemy)
    SUPABASE_DB_URL: str = ""       # async: postgresql+asyncpg://...
    SUPABASE_DB_URL_SYNC: str = ""  # sync:  postgresql+psycopg://...

    # Server
    SERVER_HOST: str = "0.0.0.0"
    SERVER_PORT: int = 8000

    # Groq AI Vision Key (Loaded dynamically from backend/.env)
    GROQ_API_KEY: str = ""

    # Real-Time Detection Pipeline
    DETECTION_ENABLED: bool = True
    DETECTION_MODEL_PATH: str = "yolov8n.pt"
    DETECTION_CONFIDENCE: float = 0.45
    DETECTION_IOU: float = 0.45
    DETECTION_IMAGE_SIZE: int = 640
    DETECTION_DEVICE: str = "auto"  # "auto", "cpu", "cuda", "cuda:0"
    DETECTION_FRAME_SKIP: int = 3
    DETECTION_MIN_CONFIDENCE: float = 0.45
    DETECTION_CONFIRM_FRAMES: int = 3
    DETECTION_EVENT_COOLDOWN: int = 10  # seconds
    DETECTION_CLASS_FILTER: str = ""  # comma-separated, empty = all classes

    # YOLO11m Webcam Detection (separate from RTSP pipeline model)
    YOLO11M_MODEL_PATH: str = "app/models/yolo11m.pt"

    # YOLOE Open-Vocabulary Detection (prompt-free, broad vocabulary)
    YOLOE_MODEL_PATH: str = "yoloe-11m-seg-pf.pt"
    YOLOE_CONF: float = 0.40
    YOLOE_IMGSZ: int = 640
    YOLOE_FPS: int = 8

    # Authentication
    SECRET_KEY: str = "09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    @property
    def DATABASE_URL(self) -> str:
        """Construct the async database connection URL.

        Priority: DATABASE_URL / SUPABASE_DB_URL env > local SQLite.
        Automatically resolves Supabase IPv4 pooler to prevent IPv6 unreachable errors on Render.
        """
        import os
        url = os.environ.get("DATABASE_URL") or os.environ.get("SUPABASE_DB_URL") or self.SUPABASE_DB_URL
        if url:
            if url.startswith("postgres://"):
                url = url.replace("postgres://", "postgresql+asyncpg://", 1)
            elif url.startswith("postgresql://") and not url.startswith("postgresql+"):
                url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
            # Render free tier has no IPv6 support. If user provides direct Supabase port 5432, route through IPv4 pooler.
            if "db.ofknpvaxynvokuzfkwds.supabase.co:5432" in url:
                url = "postgresql+asyncpg://postgres.ofknpvaxynvokuzfkwds:suHH6zklTgKZoqS8@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres"
            return url
        # If in cloud deployment (Render) without DATABASE_URL, default to the Supabase pooler
        if os.environ.get("RENDER") or os.environ.get("PORT"):
            return "postgresql+asyncpg://postgres.ofknpvaxynvokuzfkwds:suHH6zklTgKZoqS8@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres"
        return "sqlite+aiosqlite:///./ai_surveillance.db"

    @property
    def DATABASE_URL_SYNC(self) -> str:
        """Construct the sync database connection URL (for Alembic).

        Priority: DATABASE_URL_SYNC / SUPABASE_DB_URL_SYNC env > local SQLite.
        """
        import os
        url = os.environ.get("DATABASE_URL_SYNC") or os.environ.get("SUPABASE_DB_URL_SYNC") or self.SUPABASE_DB_URL_SYNC
        if url:
            if url.startswith("postgres://"):
                url = url.replace("postgres://", "postgresql+psycopg://", 1)
            elif url.startswith("postgresql://") and not url.startswith("postgresql+"):
                url = url.replace("postgresql://", "postgresql+psycopg://", 1)
            if "db.ofknpvaxynvokuzfkwds.supabase.co:5432" in url:
                url = "postgresql+psycopg://postgres.ofknpvaxynvokuzfkwds:suHH6zklTgKZoqS8@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres"
            return url
        if os.environ.get("RENDER") or os.environ.get("PORT"):
            return "postgresql+psycopg://postgres.ofknpvaxynvokuzfkwds:suHH6zklTgKZoqS8@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres"
        return "sqlite:///./ai_surveillance.db"


# Singleton settings instance
settings = Settings()
