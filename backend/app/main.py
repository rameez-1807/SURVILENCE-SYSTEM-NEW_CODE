"""
AI Surveillance System - FastAPI Application

Main application entry point. Configures the FastAPI app,
registers routers, and sets up Swagger/OpenAPI documentation.
"""

import asyncio
import os
from contextlib import asynccontextmanager

# Ensure low memory footprint and writable config dir on cloud environments (e.g. Render 512MB)
os.environ.setdefault("YOLO_CONFIG_DIR", "/tmp/Ultralytics")
os.environ.setdefault("MALLOC_ARENA_MAX", "2")
_cpu_cores = os.cpu_count() or 2
_target_threads = str(min(4, _cpu_cores))
os.environ.setdefault("OMP_NUM_THREADS", _target_threads)
os.environ.setdefault("MKL_NUM_THREADS", _target_threads)

try:
    import torch
    torch.set_num_threads(min(4, _cpu_cores))
except Exception:
    pass

from fastapi import FastAPI

from app.api.v1 import api_v1_router
from app.core.config import settings
from app.core.pipeline.orchestrator import pipeline_orchestrator
from app.core.ai.yolo11m_singleton import load_model as load_yolo11m
from app.core.ai.yoloworld_singleton import load_model as load_yoloworld


async def _periodic_memory_trimmer():
    """Periodic memory maintenance to reclaim cyclic references and flush CUDA cache."""
    import gc
    while True:
        try:
            await asyncio.sleep(30)
            gc.collect()
            try:
                import torch
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
            except Exception:
                pass
        except asyncio.CancelledError:
            break
        except Exception:
            pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup/shutdown events."""
    # Startup
    print(f"[START] Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    
    import logging
    if not settings.GROQ_API_KEY:
        logging.info("GROQ_API_KEY optional — open-set object naming (/events/vision-scan) is disabled unless configured.")
    
    # Initialize MongoDB Atlas Cloud connection & indexes if MONGODB_URL is configured
    if getattr(settings, "MONGODB_URL", None):
        try:
            from app.db.mongodb import init_mongo_indexes
            await init_mongo_indexes()
            print("[MongoDB] Connected to MongoDB Atlas Cloud Cluster0")
        except Exception as e:
            import logging
            logging.warning(f"[MongoDB] Atlas startup connection note: {e}")

    # Launch background periodic memory maintenance
    import asyncio
    trimmer_task = asyncio.create_task(_periodic_memory_trimmer())

    # Models are loaded on-demand per request to preserve RAM under cloud memory limits (512MB)

    # Start pipeline orchestrator safely in background
    if settings.DETECTION_ENABLED:
        try:
            asyncio.create_task(pipeline_orchestrator.start())
        except Exception as e:
            logging.warning(f"Pipeline orchestrator startup failed: {e}")
    
    yield
    # Shutdown
    print(f"[STOP] Shutting down {settings.APP_NAME}")
    trimmer_task.cancel()
    try:
        from app.db.mongodb import close_mongo_connections
        close_mongo_connections()
    except Exception:
        pass
    try:
        await pipeline_orchestrator.stop()
    except Exception:
        pass


TAGS_METADATA = [
    {
        "name": "Attendance",
        "description": "Biometric face attendance, 1-click Punch In / Punch Out, Facenox live scanning with anti-spoofing, and HRMS cloud sync.",
    },
    {
        "name": "Employees",
        "description": "Employee profile management, face biometric vector enrollment, and credential updates.",
    },
    {
        "name": "Vehicles / ANPR",
        "description": "Automatic Number Plate Recognition (ANPR), Indian yellow plate parsing, and vehicle history logs.",
    },
    {
        "name": "Detection Pipeline",
        "description": "Real-time YOLOv8, YOLO11, and RF-DETR object detection pipeline telemetry, FPS, and tracking state.",
    },
    {
        "name": "Detection Zones",
        "description": "Camera Region of Interest (ROI) polygon zones, tripwires, and sensitivity configuration.",
    },
    {
        "name": "Events",
        "description": "Security events, Groq Multimodal AI Vision verification, and Human-in-the-Loop review queue.",
    },
    {
        "name": "Evidence",
        "description": "Snapshot and video evidence vault, direct media preview, and signed secure download URLs.",
    },
    {
        "name": "Cameras",
        "description": "Multi-camera matrix, RTSP streams, USB webcams, and frame acquisition.",
    },
    {
        "name": "Auth",
        "description": "OAuth2 JWT token authentication and access control.",
    },
    {
        "name": "Tenants",
        "description": "Multi-tenant organization hierarchy and data isolation.",
    },
    {
        "name": "Sites",
        "description": "Physical site and facility management.",
    },
    {
        "name": "Rules",
        "description": "Security alerting rules, zone violation conditions, and incident triggers.",
    },
    {
        "name": "Recognition History",
        "description": "Face recognition history, search queries, and historical match logs.",
    },
    {
        "name": "Health",
        "description": "System health and telemetry status.",
    },
]


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title=f"{settings.APP_NAME} — Enterprise API",
        version=settings.APP_VERSION,
        description=(
            "### 🛡️ AI Surveillance, Biometrics & Real-Time Analytics Platform\n\n"
            "Comprehensive RESTful and WebSocket API providing:\n"
            "- **Biometric Attendance & Facenox SOTA Face Recognition**: ArcFace 512-d matching, MiniFASNetV2 anti-spoofing, dual punch-in / punch-out events.\n"
            "- **Real-Time Video Analytics**: YOLOv8, YOLO11, and RF-DETR object detection with ByteTrack persistent identity tracking.\n"
            "- **ANPR License Plate Recognition**: Indian vehicle plate OCR and parking access management.\n"
            "- **Groq Multimodal AI Vision**: Secondary semantic scene verification using `qwen/qwen3.6-27b`.\n"
            "- **Human-in-the-Loop Review Queue**: Instant label correction and incident audit workflows.\n\n"
            "Interactive Swagger documentation is available at `/docs`, ReDoc at `/redoc`, and OpenAPI JSON schema at `/openapi.json`."
        ),
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        openapi_tags=TAGS_METADATA,
        lifespan=lifespan,
    )

    # Secure CORS middleware configuration
    from fastapi.middleware.cors import CORSMiddleware
    
    configured_origins = [
        o.strip() for o in getattr(settings, "CORS_ORIGINS", "").split(",") if o.strip()
    ]
    default_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "https://18.117.247.217",
        "http://18.117.247.217",
    ]
    origins = list(dict.fromkeys(configured_origins + default_origins))

    if "*" in configured_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=False,
            allow_methods=["*"],
            allow_headers=["*"],
            expose_headers=["*"],
        )
    else:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=origins,
            allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|18\.117\.247\.217)(:\d+)?$",
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
            expose_headers=["*"],
        )


    # Register API routers
    app.include_router(api_v1_router)

    from fastapi.responses import JSONResponse
    from fastapi import Request

    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        import traceback
        import logging
        err_msg = str(exc)
        trace = traceback.format_exc()
        logging.error(f'[App] Unhandled Exception on {request.method} {request.url.path}: {err_msg}\n{trace}')
        return JSONResponse(
            status_code=500,
            content={'detail': f'Internal Server Error ({type(exc).__name__}): {err_msg}'}
        )

    @app.get("/")
    @app.head("/")
    @app.get("/health")
    @app.head("/health")
    async def root():
        return {
            "status": "healthy",
            "app": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "docs": "/docs"
        }

    return app


# Application instance
app = create_app()
