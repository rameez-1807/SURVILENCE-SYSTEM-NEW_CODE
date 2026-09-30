"""
AI Surveillance System - Health Check Router

Provides the health check endpoint for monitoring.
"""

from fastapi import APIRouter

from app.schemas.health import HealthResponse

router = APIRouter(tags=["Health"])


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Health Check",
    description="Returns the health status of the API.",
)
async def health_check() -> HealthResponse:
    """Check if the API is running and healthy."""
    return HealthResponse(status="healthy")
