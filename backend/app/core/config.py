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

    # Server
    SERVER_HOST: str = "0.0.0.0"
    SERVER_PORT: int = 8000

    # Groq AI Vision Key (Loaded dynamically from backend/.env)
    GROQ_API_KEY: str = ""

    # Authentication
    SECRET_KEY: str = "09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    @property
    def DATABASE_URL(self) -> str:
        """Construct the async PostgreSQL connection URL."""
        return "sqlite+aiosqlite:///./ai_surveillance.db"

    @property
    def DATABASE_URL_SYNC(self) -> str:
        """Construct the sync PostgreSQL connection URL (for Alembic)."""
        return "sqlite:///./ai_surveillance.db"


# Singleton settings instance
settings = Settings()
