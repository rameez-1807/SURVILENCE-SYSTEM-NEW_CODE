<div align="center">
  <br />
  <img src="https://img.icons8.com/?size=512&id=v9pIqV60v1mO&format=png" alt="Backend Logo" width="100" />
  <br />

  <h1>🧠 <strong>AI Surveillance & Facenox Biometric Backend Service</strong></h1>
  <p><strong>FastAPI-Powered Real-Time YOLOv8 & ByteTrack Video Analytics, ANPR Engine, Groq AI Multimodal Vision, Facenox SOTA Face Recognition, Biometric Attendance & Cloud MySQL Persistence</strong></p>

  <p>
    <a href="https://github.com/rameez-1807/SURVILENCE-SYSTEM-NEW_CODE.git"><img src="https://img.shields.io/badge/GitHub-SURVILENCE--SYSTEM--NEW__CODE-181717?style=for-the-badge&logo=github&logoColor=white" alt="GitHub Repo" /></a>
    <a href="https://fastapi.tiangolo.com/"><img src="https://img.shields.io/badge/FastAPI-0.115+-005571?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" /></a>
    <a href="https://ultralytics.com/"><img src="https://img.shields.io/badge/YOLOv8-Ultralytics-00599C?style=for-the-badge&logo=yolo&logoColor=white" alt="YOLOv8" /></a>
    <a href="https://groq.com/"><img src="https://img.shields.io/badge/Groq_Vision_AI-f55036?style=for-the-badge&logo=groq&logoColor=white" alt="Groq Vision AI" /></a>
    <a href="https://www.python.org/"><img src="https://img.shields.io/badge/Python-3.12+-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python 3.12" /></a>
    <a href="https://www.sqlalchemy.org/"><img src="https://img.shields.io/badge/SQLAlchemy-2.0+-D71F00?style=for-the-badge&logo=sqlalchemy&logoColor=white" alt="SQLAlchemy 2.0" /></a>
    <a href="https://www.mysql.com/"><img src="https://img.shields.io/badge/MySQL-Hostinger_Cloud-4479A1?style=for-the-badge&logo=mysql&logoColor=white" alt="MySQL" /></a>
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
- **Facenox SOTA Face Biometrics & Dual Punch Attendance**: Real-time ArcFace 512-d feature matching, YuNet face detection, MiniFASNetV2 anti-spoofing liveness, separate punch-in and punch-out events, and HRMS synchronization (`/api/v1/attendance`, `/api/v1/employees`).
- **Multi-Tenant Data Isolation** & security incident rules (`/api/v1/tenants`, `/api/v1/sites`, `/api/v1/cameras`).

Built using **Domain-Driven Design (DDD)** principles and asynchronous I/O, it cleanly separates Repositories, Services, Schemas (Pydantic DTOs), and API Routers for maximal performance and horizontal scalability.

---

## ⚡ Core Modules & Capabilities

### 🪪 1. Facenox SOTA Biometric Platform & Dual Punch Architecture (`app/api/v1/attendance.py`, `app/api/v1/employees.py`)
- **Separate Punch In & Punch Out Events**:
  - Treats each entry (`punch_in`) and exit (`punch_out`) as an independent, auditable log row with dedicated timestamps (`time` vs `recorded_at`), camera source tracking, and confidence scoring.
  - Automatically checks employee status and locks duplicate punches within debounced intervals.
- **Deep Biometric Engine Pipeline**:
  - **YuNet Detector**: Fast, lightweight rotation-invariant face landmark localization.
  - **MiniFASNetV2 Anti-Spoofing**: Defense against digital screens, printed photographs, and silicone masks.
  - **ArcFace 512-Dimensional Deep Embeddings**: Sub-second cosine similarity calculation against enrolled employee vectors.
- **Dual Camera Ingestion Options**:
  - **Browser WebRTC Camera Stream**: Zero-latency HTML5 canvas frames uploaded via base64 for instant cross-platform compatibility.
  - **Direct USB WebCam Engine**: Direct OpenCV DirectShow capture on device 0 with automatic retry and software fallback.
- **HRMS Cloud Integration**:
  - Two-way synchronization endpoint (`POST /api/v1/attendance/sync-hrms`) forwarding punch events to external ERP/HRMS systems configured via environment variables.

### 🎯 2. Real-Time YOLOv8 & ByteTrack Pipeline (`app/services/detection/`)
- Continuous RTSP frame ingestion via bounded-queue Pub/Sub (`FrameHub`).
- Native YOLOv8 inference with GPU/CPU auto-detection and `torch.no_grad()` optimization.
- ByteTrack tracking for stable `track_id` assignments across consecutive frames.
- Temporal confirmation (requires N confirmed frames) and debounced cooldown timers.
- Automatic rolling frame buffer with annotated evidence snapshot generation (`/evidence/snapshots/`).
- Telemetry collector tracking FPS, avg/P95 inference latency, GPU memory, and active tracks (`GET /api/v1/detection/status`).

### 🛡️ 3. Camera ROI Detection Zones (`app/models/detection_zone.py`, `app/api/v1/zones.py`)
- Camera-specific polygon zones with point-in-polygon ray-casting evaluation.
- Configurable zone types (`restricted`, `entrance`, `parking`, `loitering`) and severity thresholds.

### 🚗 4. ANPR License Plate Engine (`app/services/vehicle.py`)
- OpenCV contour bounding rect detection and Tesseract OCR text extraction.
- Formats Indian license plate numbers (e.g. `JH03MF4477`, `UP16BT4321`) and tags location spots (`📍 Apartment Parking`).
- Async database storage and bulk history clear route (`DELETE /api/v1/vehicles`).

### ⚡ 5. Groq Multimodal AI Vision Engine (`app/api/v1/events.py`, `app/services/detection/groq_verifier.py`)
- Integrates Groq API (`GROQ_API_KEY`) using model `qwen/qwen3.6-27b`.
- Performs secondary semantic verification on confirmed security events without blocking live streams.
- Built-in Regex sanitizer (`re.sub(r'<think>.*?</think>', '', ...)`) strips internal LLM thinking tags to return clean 1-3 word object names.

### 📝 6. Human-in-the-Loop Review Queue (`app/api/v1/events.py`)
- `/events/review-queue`: Fetches security incidents flagged for human review.
- `/events/{event_id}/correct-label`: PATCH endpoint for updating object classification labels in real time.

---

## 📡 API Reference & Endpoints

### 🪪 Biometric Attendance & Facenox Endpoints

| Method | Endpoint | Description |
|:---|:---|:---|
| `GET` | `/api/v1/attendance` | List attendance records with date, employee, and search filters |
| `POST` | `/api/v1/attendance` | Create a manual biometric attendance record |
| `POST` | `/api/v1/attendance/punch` | 1-Click Punch In or Punch Out with timestamp, camera source & status logging |
| `POST` | `/api/v1/attendance/facenox-scan` | Real-time face matching with YuNet + ArcFace 512d + MiniFASNetV2 anti-spoofing |
| `POST` | `/api/v1/attendance/hardware-webcam/scan` | Native DirectShow hardware webcam acquisition on device 0 |
| `GET` | `/api/v1/attendance/hardware-webcam/capture` | Capture single frame from USB camera for enrollment |
| `POST` | `/api/v1/attendance/sync-hrms` | Two-way synchronization with external HRMS attendance systems |
| `GET` | `/api/v1/employees` | List registered employee roster with biometric status |
| `POST` | `/api/v1/employees/register` | Register new employee profile with 512-d face biometric vector |
| `DELETE`| `/api/v1/employees/{id}/face` | Remove facial biometric embeddings while preserving profile |

#### Example: 1-Click Punch Request (`POST /api/v1/attendance/punch`)
```json
{
  "employee_id": "11",
  "punch_type": "punch_out",
  "camera_source": "Facenox Live Scanner",
  "confidence": 98.5
}
```

#### Example: Facenox Live Scan (`POST /api/v1/attendance/facenox-scan`)
```json
{
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQE...",
  "punch_type": "punch_in",
  "camera_source": "Browser WebRTC",
  "min_confidence": 0.65
}
```

---

## 🛠️ Architecture & Directory Structure

```text
backend/
├── alembic/                         # Migration scripts & env setup
│   └── versions/                    # Revision history
├── app/                             
│   ├── api/v1/                      # Versioned API Routers
│   │   ├── attendance.py            # Biometric Attendance & Facenox endpoints
│   │   ├── employees.py             # Employee profile & face vector management
│   │   ├── detection.py             # Real-time pipeline status, tracks & telemetry
│   │   ├── zones.py                 # ROI detection zones CRUD
│   │   ├── vehicles.py              # ANPR Vehicles API (scan, list, delete)
│   │   ├── events.py                # Security Events, Groq Vision & Review Queue API
│   │   ├── auth.py                  # OAuth2 JWT Tokens
│   │   ├── cameras.py               # Camera stream management
│   │   ├── rules.py                 # Security trigger rules
│   │   ├── sites.py                 # Site location management
│   │   └── tenants.py               # Tenant organization management
│   ├── core/                        # FrameHub, CameraManager, YOLO Plugin, Tracker, Security
│   ├── models/                      # Async SQLAlchemy ORM Models (AttendanceRecord, Employee, Event, etc.)
│   ├── repositories/                # Async Database Repositories
│   ├── schemas/                     # Pydantic Schemas (DTOs)
│   └── services/                    
│       ├── detection/               # Pipeline, Metrics, Evidence, Groq Verifier
│       ├── vehicle.py               # ANPR & Vehicle Business Logic Layer
│       └── face/                    # YuNet, ArcFace & MiniFASNetV2 biometrics
├── .env                             # Environment File (DATABASE_URL, GROQ_API_KEY)
├── ai_surveillance.db               # Local SQLite Database Fallback
└── requirements.txt                 # Backend Python dependencies
```

---

## ⚙️ Environment Configuration (`.env`)

```ini
# Database Connection (Hostinger Cloud MySQL or Local SQLite)
DATABASE_URL=mysql+aiomysql://u123456:password@srv1100.hstgr.io:3306/u123456_attendance
# Fallback SQLite:
# DATABASE_URL=sqlite+aiosqlite:///./ai_surveillance.db

# Groq Multimodal AI Vision API
GROQ_API_KEY=gsk_your_groq_api_key_here
GROQ_MODEL=qwen/qwen3.6-27b

# External HRMS Integration
HRMS_API_ENDPOINT=https://hrms.yourcompany.com/api/v1/punches
HRMS_API_KEY=hrms_secret_bearer_token

# Security & Tokens
SECRET_KEY=your-super-secret-jwt-signing-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
```

---

## 🚀 Getting Started

```bash
# 1. Activate virtual environment
# Windows (PowerShell):
..\venv\Scripts\Activate.ps1
# Linux / macOS:
source ../venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Run database migrations
alembic upgrade head

# 4. Start FastAPI server with live reload
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
