<div align="center">
  <br />
  <img src="https://img.icons8.com/?size=512&id=v9pIqV60v1mO&format=png" alt="Backend Logo" width="100" />
  <br />

  <h1>🧠 <strong>AI Surveillance Backend Service</strong></h1>
  <p><strong>FastAPI-Powered Real-Time YOLOv8 & ByteTrack Video Analytics, ANPR Engine, Groq AI Multimodal Vision, Human Review Queue & WebSocket Event Delivery</strong></p>

  <p>
    <a href="https://github.com/rameez-1807/SURVILENCE-SYSTEM-NEW_CODE.git"><img src="https://img.shields.io/badge/GitHub-SURVILENCE--SYSTEM--NEW__CODE-181717?style=for-the-badge&logo=github&logoColor=white" alt="GitHub Repo" /></a>
    <a href="https://fastapi.tiangolo.com/"><img src="https://img.shields.io/badge/FastAPI-0.115+-005571?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" /></a>
    <a href="https://ultralytics.com/"><img src="https://img.shields.io/badge/YOLOv8-Ultralytics-00599C?style=for-the-badge&logo=yolo&logoColor=white" alt="YOLOv8" /></a>
    <a href="https://groq.com/"><img src="https://img.shields.io/badge/Groq_Vision_AI-f55036?style=for-the-badge&logo=groq&logoColor=white" alt="Groq Vision AI" /></a>
    <a href="https://www.python.org/"><img src="https://img.shields.io/badge/Python-3.12+-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python 3.12" /></a>
    <a href="https://www.sqlalchemy.org/"><img src="https://img.shields.io/badge/SQLAlchemy-2.0+-D71F00?style=for-the-badge&logo=sqlalchemy&logoColor=white" alt="SQLAlchemy 2.0" /></a>
  </p>
</div>

---

## 📖 Overview

The backend service for the **AI Surveillance System** serves as the core intelligence engine. It handles:
- **Real-Time YOLOv8 Detection & ByteTrack Multi-Object Tracking** (`/api/v1/detection`).
- **Camera Regions of Interest (ROI) & Security Zones** (`/api/v1/zones`).
- **Automatic License Plate Recognition (ANPR)** and vehicle history persistence (`/api/v1/vehicles`).
- **Groq Multimodal AI Vision** secondary verification (`/api/v1/events/vision-scan`).
- **Human-in-the-Loop Review Queue** & label correction (`/api/v1/events/review-queue`).
- **Biometric Employee Profile Management** & face attendance tracking (`/api/v1/attendance`, `/api/v1/employees`).
- **Multi-Tenant Data Isolation** & security incident rules (`/api/v1/tenants`, `/api/v1/sites`, `/api/v1/cameras`).

Built using **Domain-Driven Design (DDD)** principles and asynchronous I/O, it separates Repositories, Services, Schemas (Pydantic DTOs), and API Routers for maximal performance and horizontal scalability.

---

## ⚡ Core Modules & Features

- 🎯 **Real-Time YOLOv8 & ByteTrack Pipeline (`app/services/detection/`)**:
  - Continuous RTSP frame ingestion via bounded-queue Pub/Sub (`FrameHub`).
  - Native YOLOv8 inference with GPU/CPU auto-detection and `torch.no_grad()` optimization.
  - ByteTrack tracking for stable `track_id` assignments across consecutive frames.
  - Temporal confirmation (requires N confirmed frames) and debounced cooldown timers.
  - Automatic rolling frame buffer with annotated evidence snapshot generation (`/evidence/snapshots/`).
  - Telemetry collector tracking FPS, avg/P95 inference latency, GPU memory, and active tracks (`GET /api/v1/detection/status`).

- 🛡️ **Camera ROI Detection Zones (`app/models/detection_zone.py`, `app/api/v1/zones.py`)**:
  - Camera-specific polygon zones with point-in-polygon ray-casting evaluation.
  - Configurable zone types (`restricted`, `entrance`, `parking`, `loitering`) and severity thresholds.

- 🚗 **ANPR License Plate Engine (`app/services/vehicle.py`)**:
  - OpenCV contour bounding rect detection and Tesseract OCR text extraction.
  - Formats Indian license plate numbers (e.g. `JH03MF4477`, `UP16BT4321`) and tags location spots (`📍 Apartment Parking`).
  - Async database storage and bulk history clear route (`DELETE /api/v1/vehicles`).

- ⚡ **Groq Multimodal AI Vision Engine (`app/api/v1/events.py`, `app/services/detection/groq_verifier.py`)**:
  - Integrates Groq API (`GROQ_API_KEY`) using model `qwen/qwen3.6-27b`.
  - Performs secondary semantic verification on confirmed security events without blocking live streams.
  - Built-in Regex sanitizer (`re.sub(r'<think>.*?</think>', '', ...)`) strips internal LLM thinking tags to return clean 1-3 word object names.

- 📝 **Human-in-the-Loop Review Queue (`app/api/v1/events.py`)**:
  - `/events/review-queue`: Fetches security incidents flagged for human review.
  - `/events/{event_id}/correct-label`: PATCH endpoint for updating object classification labels in real time.

- 🪪 **Biometric Attendance & Employee Module**:
  - Complete CRUD operations for employee biometric profiles, automated & manual attendance logging, confidence scoring, and daily aggregations.

- 🏢 **Multi-Tenant Organization Hierarchy**:
  - Complete data isolation (`Tenants` ➔ `Sites` ➔ `Cameras`).

---

## 🛠️ Architecture & Module Structure

```text
backend/
├── alembic/                         # Migration scripts & env setup
│   └── versions/                    # Revision history
├── app/                             
│   ├── api/v1/                      # Versioned API Routers
│   │   ├── detection.py             # Real-time pipeline status, tracks & telemetry
│   │   ├── zones.py                 # ROI detection zones CRUD
│   │   ├── vehicles.py              # ANPR Vehicles API (scan, list, delete)
│   │   ├── events.py                # Security Events, Groq Vision & Review Queue API
│   │   ├── auth.py                  # OAuth2 JWT Tokens
│   │   ├── attendance.py            # Biometric Attendance endpoints
│   │   ├── employees.py             # Employee profile management
│   │   ├── cameras.py               # Camera stream management
│   │   ├── rules.py                 # Security trigger rules
│   │   ├── sites.py                 # Site location management
│   │   └── tenants.py               # Tenant organization management
│   ├── core/                        # FrameHub, CameraManager, YOLO Plugin, Tracker, Security
│   ├── models/                      # Async SQLAlchemy ORM Models (Event, DetectionZone, VehicleRecord, etc.)
│   ├── repositories/                # Async Database Repositories
│   ├── schemas/                     # Pydantic Schemas (DTOs)
│   └── services/                    
│       ├── detection/               # Pipeline, Metrics, Evidence, Groq Verifier
│       └── vehicle.py               # ANPR & Vehicle Business Logic Layer
├── .env                             # Environment File (DATABASE_URL, GROQ_API_KEY)
├── ai_surveillance.db               # SQLite / PostgreSQL Database Instance
└── requirements.txt                 # Backend Python dependencies
```

---

## 🚀 Getting Started

```bash
# Activate virtual environment
# Windows (PowerShell):
..\venv\Scripts\Activate.ps1
# Linux / macOS:
source ../venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run migrations
alembic upgrade head

# Start development server
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
