"""
Tests for the health check endpoint.

GET /api/v1/health
"""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_health_check_returns_200():
    """Health check should return 200 OK."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/v1/health")

    assert response.status_code == 200


@pytest.mark.asyncio
async def test_health_check_returns_healthy_status():
    """Health check should return {"status": "healthy"}."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/v1/health")

    data = response.json()
    assert data == {"status": "healthy"}


@pytest.mark.asyncio
async def test_health_check_response_content_type():
    """Health check should return JSON content type."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/v1/health")

    assert response.headers["content-type"] == "application/json"
