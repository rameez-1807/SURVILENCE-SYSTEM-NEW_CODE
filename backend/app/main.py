"""
AI Surveillance System - FastAPI Application

Main application entry point. Configures the FastAPI app,
registers routers, and sets up Swagger/OpenAPI documentation.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.v1 import api_v1_router
from app.core.config import settings
from app.core.pipeline.orchestrator import pipeline_orchestrator
from app.core.ai.yolo11m_singleton import load_model as load_yolo11m


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup/shutdown events."""
    # Startup
    print(f"[START] Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    
    import asyncio
    asyncio.create_task(pipeline_orchestrator.start())
    
    # Preload YOLO11m singleton model
    try:
        await asyncio.to_thread(load_yolo11m)
    except Exception as e:
        print(f"[ERROR] Failed to load YOLO11m model: {e}")
    
    yield
    # Shutdown
    print(f"[STOP] Shutting down {settings.APP_NAME}")
    await pipeline_orchestrator.stop()


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description=(
            "Backend API for the AI Surveillance System. "
            "Provides endpoints for camera management, AI-powered "
            "video analytics, and real-time event monitoring."
        ),
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    # Add CORS middleware
    from fastapi.middleware.cors import CORSMiddleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Adjust this in production
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register API routers
    app.include_router(api_v1_router)

    return app


# Application instance
app = create_app()
