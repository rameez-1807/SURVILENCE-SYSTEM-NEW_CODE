"""
AI Surveillance System - API v1 Router

Aggregates all v1 endpoint routers.
"""

from fastapi import APIRouter

from app.api.v1.health import router as health_router
from app.api.v1.tenants import router as tenants_router
from app.api.v1.sites import router as sites_router
from app.api.v1.auth import router as auth_router
from app.api.v1.cameras import router as cameras_router
from app.api.v1.rules import router as rules_router
from app.api.v1.events import router as events_router
from app.api.v1.websockets import router as websockets_router
from app.api.v1.employees import router as employees_router

api_v1_router = APIRouter(prefix="/api/v1")

api_v1_router.include_router(health_router)
api_v1_router.include_router(auth_router)
api_v1_router.include_router(tenants_router)
api_v1_router.include_router(sites_router)
api_v1_router.include_router(cameras_router)
api_v1_router.include_router(rules_router)
api_v1_router.include_router(events_router)
api_v1_router.include_router(websockets_router)
api_v1_router.include_router(employees_router)
