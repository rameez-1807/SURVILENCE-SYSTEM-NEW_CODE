<div align="center">
  <br />
  <img src="https://img.icons8.com/?size=512&id=v9pIqV60v1mO&format=png" alt="AI Surveillance Logo" width="120" />
  <br />
  <br />

  <h1>🛡️ <strong>AI SURVEILLANCE & REAL-TIME INTELLIGENCE SYSTEM</strong></h1>
  <p>
    <strong>Enterprise-Grade Real-Time Video Analytics, YOLOv8 Object Detection, ByteTrack Tracking, ANPR Vehicle Scanner, Groq Multimodal Vision AI, Review Queue & Biometric Attendance Platform</strong>
  </p>

  <p>
    <a href="https://github.com/rameez-1807/SURVILENCE-SYSTEM-NEW_CODE.git"><img src="https://img.shields.io/badge/GitHub-SURVILENCE--SYSTEM--NEW__CODE-181717?style=for-the-badge&logo=github&logoColor=white" alt="GitHub Repo" /></a>
    <a href="https://fastapi.tiangolo.com/"><img src="https://img.shields.io/badge/FastAPI-0.115+-005571?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" /></a>
    <a href="https://ultralytics.com/"><img src="https://img.shields.io/badge/YOLOv8-Ultralytics-00599C?style=for-the-badge&logo=yolo&logoColor=white" alt="YOLOv8" /></a>
    <a href="https://groq.com/"><img src="https://img.shields.io/badge/Groq_Vision_AI-f55036?style=for-the-badge&logo=groq&logoColor=white" alt="Groq Vision AI" /></a>
    <a href="https://react.dev/"><img src="https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React 19" /></a>
    <a href="https://vitejs.dev/"><img src="https://img.shields.io/badge/Vite_8-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E" alt="Vite 8" /></a>
    <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/Tailwind_CSS_v4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS v4" /></a>
    <a href="https://postgresql.org/"><img src="https://img.shields.io/badge/PostgreSQL_/_SQLite-003B57?style=for-the-badge&logo=postgresql&logoColor=white" alt="Database" /></a>
  </p>

  <p>
    <a href="#-system-overview">System Overview</a> •
    <a href="#-system-architecture">Architecture</a> •
    <a href="#-core-modules--features">Modules & Features</a> •
    <a href="#-detection-pipeline-flowchart">Detection Pipeline</a> •
    <a href="#-api-reference">API Reference</a> •
    <a href="#-installation--setup">Installation Guide</a> •
    <a href="#-directory-structure">Project Structure</a>
  </p>
</div>

---

## 📖 System Overview

The **AI Surveillance System** is a next-generation, high-performance security intelligence platform engineered for enterprise facilities, corporate parks, residential societies, and smart cities.

It seamlessly unifies **real-time edge AI video analytics**, **continuous multi-object tracking (ByteTrack)**, **Automatic Number Plate Recognition (ANPR)**, **Groq Multimodal LLM Vision verification**, **Human-in-the-Loop Review Queue**, and **biometric facial attendance** into an ultra-fast, responsive web interface.

> [!NOTE]
> Engineered with a production-grade asynchronous backend architecture (FastAPI + SQLAlchemy 2.0 Async + WebSockets) coupled with a modern React 19 glassmorphism UI dashboard.

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph Video_Ingestion["📹 Camera & Video Ingestion"]
        RTSP["CCTV / RTSP Stream"] --> Worker["CaptureWorker (OpenCV)"]
        Webcam["Live USB/Webcam"] --> Worker
        Worker --> Hub["FrameHub (Bounded Pub-Sub Buffer)"]
    end

    subgraph AI_Engine["🧠 AI & Vision Pipeline"]
        Hub --> YOLO["YOLOv8 Object Detector (CUDA / CPU)"]
        YOLO --> Tracker["ByteTrack Multi-Object Tracker (Stable track_id)"]
        Tracker --> Confirm["Temporal Confirmation (N-Frames Filter)"]
        Confirm --> Zones["ROI & Security Detection Zones"]
        Zones --> Cooldown["Cooldown Debouncing"]
        Cooldown --> Snapshot["Evidence Snapshot Generator"]
        Snapshot -.-> Groq["Groq Vision API (Qwen 3.6 27B Multimodal Verification)"]
    end

    subgraph Storage_and_Messaging["💾 Persistence & Real-Time Sync"]
        Cooldown --> EventEngine["Rules & Event Engine"]
        EventEngine --> DB[(PostgreSQL / Supabase / Neon / SQLite Async DB)]
        EventEngine --> WS["WebSocket Broadcaster"]
    end

    subgraph Frontend_App["📊 React 19 Frontend Web Portal"]
        WS --> UI["Live Dashboard & Alerts"]
        DB --> UI
        UI --> ANPR_UI["🚗 ANPR License Plates View"]
        UI --> Obj_UI["🎯 Object Tracking & Scanner"]
        UI --> Review_UI["📝 Human Review Queue (/review-queue)"]
        UI --> Att_UI["🪪 Biometric Face Attendance"]
    end
```

---

## ✨ Core Modules & Features

### 🎯 1. Real-Time YOLOv8 & ByteTrack Multi-Object Tracking
- **Single Model Load**: YOLOv8 neural weights loaded once at service initialization via singleton pattern.
- **Hardware Acceleration**: Automatic GPU detection with CUDA fallback to CPU and zero-copy inference (`torch.no_grad()`).
- **Persistent Tracking**: ByteTrack tracker assigns deterministic `track_id` integers across consecutive frames.
- **Temporal Filter**: Requires $N$ consecutive confirmations before triggering alarms, eliminating camera sensor flicker.
- **Cooldown Debouncer**: Intelligent per-`(track_id, label)` timer eliminates duplicate alarm storms.
- **Annotated Evidence Snapshots**: Automatic bounding box overlay saved to `/evidence/snapshots/`.
- **Telemetry Stream**: Live FPS, average/P95 latency, GPU memory, active tracks, and dropped frames (`GET /api/v1/detection/status`).

### 🛡️ 2. Camera ROI & Security Detection Zones
- **Configurable Polygon Polygons**: Camera-specific polygon coordinates normalized in $[0, 1]$.
- **Ray-Casting Algorithm**: Real-time point-in-polygon checks for perimeter breaches, restricted areas, and loitering.

### 🚗 3. ANPR Vehicle License Plate Scanner & DB Recorder (`/vehicles`)
- **Dual Camera & Upload Scanner**: Real-time license plate extraction using OpenCV contour geometry and Tesseract OCR.
- **Indian License Plate Badges**: High-contrast yellow badge rendering (`JH03MF4477`, `UP16BT4321`) with location spot tagging (`📍 Apartment Parking`).
- **Speech Synthesis**: Top header pill button (`🔊 Voice Announcement ON` / `🔇 Voice Announcement OFF`) with instant audio cancellation.
- **Permanent Database Persistence**: Direct async database writes with search, filters, and CSV export.

### ⚡ 4. Groq Multimodal AI Vision Engine (`/events/vision-scan`)
- **Qwen Multimodal LLM (`qwen/qwen3.6-27b`)**: Sub-second semantic verification of handheld items (**Computer Mouse**, **Pen / Marker**, **Smartphone**, **Laptop**, **Bottle**, **Glasses**).
- **Background Clutter Removal**: Automatic suppression of background furniture (`chair`, `tv`, `wall`, `door`).
- **Thinking Tag Sanitizer**: Strips internal `<think>` blocks to deliver clean 1-3 word object titles.

### 📝 5. Human-in-the-Loop Review Queue (`/review-queue`)
- **Unverified Event Audit**: Centralized queue for security personnel to audit detection events marked as `needs_review`.
- **Label Correction & Model Feedback**: Update object classification tags in real time with instant database sync (`PATCH /api/v1/events/{id}/correct-label`).

### 🪪 6. Biometric Face Attendance System (`/attendance`)
- **Edge Neural Face Recognition**: In-browser Face-API.js neural network inference.
- **Employee Directory**: Profile registration, automated check-in/out logging, confidence scoring, and daily attendance cards.

---

## 📊 Feature Comparison Matrix

| Feature | Built-in CCTV Standard | Traditional OCR | 🛡️ Our AI Surveillance System |
|---|:---:|:---:|:---:|
| **Object Detection** | ❌ Motion only | ❌ None | ✅ **YOLOv8 + Bounding Box (640px)** |
| **Object Tracking** | ❌ None | ❌ None | ✅ **ByteTrack Persistent `track_id`** |
| **False Alarm Suppression** | ❌ High false alarms | ❌ None | ✅ **Temporal N-Frame Confirmation** |
| **License Plate Recognition** | ❌ None | ⚠️ Static only | ✅ **Real-Time Video ANPR + OCR** |
| **AI LLM Verification** | ❌ None | ❌ None | ✅ **Groq Multimodal Vision (Qwen 27B)** |
| **Human Review Queue** | ❌ None | ❌ None | ✅ **Interactive Label Correction (/review-queue)** |
| **Evidence Snapshots** | ❌ Manual | ❌ Manual | ✅ **Auto Annotated JPEG + Watermark** |
| **Multi-Database Support** | ❌ Proprietary | ❌ None | ✅ **Async PostgreSQL / Neon / Supabase / SQLite** |
| **Real-Time Dashboard** | ❌ Legacy NVR | ❌ None | ✅ **React 19 + WebSockets + Tailwind v4** |

---

## 🛠️ Technology Stack

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                               TECH STACK                                 │
├─────────────────┬────────────────────────────────────────────────────────┤
│ Backend Layer   │ Python 3.12+, FastAPI, SQLAlchemy 2.0 Async, Alembic  │
│ Computer Vision │ OpenCV, Ultralytics YOLOv8, Supervision (ByteTrack)   │
│ AI / Multimodal │ Groq Vision API (Qwen 27B), PyTorch, Torchvision       │
│ Database Layer  │ PostgreSQL (Neon / Supabase) / SQLite Async Engine     │
│ Frontend Portal │ React 19, Vite 8, TypeScript, Tailwind CSS v4, Lucide  │
│ Real-Time Sync  │ WebSockets, Asyncio, HTML5 Canvas                      │
└─────────────────┴────────────────────────────────────────────────────────┘
```

---

## 📡 API Reference

### 🎯 Detection & Tracking Telemetry
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/detection/status` | Real-time pipeline health, FPS, average/P95 latency, GPU metrics & track counts |
| `GET` | `/api/v1/detection/cameras/{id}/tracks` | List all active tracked objects with duration and bounding boxes |
| `GET` | `/api/v1/detection/cameras/{id}/detections` | Get raw detections for latest camera frame |

### 🛡️ ROI Detection Zones
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/zones` | Create polygon ROI detection zone for camera |
| `GET` | `/api/v1/zones/camera/{camera_id}` | List all detection zones for camera |
| `PATCH` | `/api/v1/zones/{zone_id}` | Update detection zone polygon or settings |
| `DELETE` | `/api/v1/zones/{zone_id}` | Delete detection zone |

### 🚗 ANPR Vehicles & Security Events
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/vehicles/scan` | Live ANPR license plate scanner & DB recorder |
| `GET` | `/api/v1/vehicles` | List all scanned vehicle records |
| `DELETE` | `/api/v1/vehicles` | Clear all vehicle records from database |
| `POST` | `/api/v1/events/vision-scan` | High-precision Groq AI Multimodal vision scan |
| `GET` | `/api/v1/events` | List all security events |
| `GET` | `/api/v1/events/review-queue` | List unverified events requiring human review |
| `PATCH` | `/api/v1/events/{id}/correct-label` | Correct label for security event in review queue |
| `DELETE` | `/api/v1/events/clear-all` | Clear all saved object events |
| `WS` | `/api/v1/ws` | Real-time WebSocket alerts and telemetry feed |

---

## 🚀 Installation & Setup

### Prerequisites
- **Python**: 3.12 or higher
- **Node.js**: 18.0 or higher & npm
- **Git**: Installed and configured

---

### Step 1: Clone the Repository
```bash
git clone https://github.com/rameez-1807/SURVILENCE-SYSTEM-NEW_CODE.git
cd SURVILENCE-SYSTEM-NEW_CODE
```

---

### Step 2: Backend Setup
```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv ../venv

# Activate virtual environment
# Windows (PowerShell):
..\venv\Scripts\Activate.ps1
# Linux / macOS:
source ../venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt

# Run database migrations
alembic upgrade head

# Start FastAPI backend server
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

---

### Step 3: Frontend Setup
```bash
# Open a new terminal and navigate to frontend directory
cd frontend

# Install Node packages
npm install

# Start Vite dev server
npm run dev
```

---

---

### Step 4: Access the System
- 🌐 **Web Dashboard**: `http://localhost:5173`
- 📚 **Swagger API Docs**: `http://127.0.0.1:8000/docs`
- 📖 **ReDoc Documentation**: `http://127.0.0.1:8000/redoc`

---

## 🚀 Cloud Deployment Guide

### 🟣 Deploy Backend to Render

1. Log in to [Render.com](https://render.com) and click **New +** → **Web Service**.
2. Connect your repository: `https://github.com/rameez-1807/SURVILENCE-SYSTEM-NEW_CODE.git`.
3. Configure settings:
   - **Root Directory**: `backend`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Add **Environment Variables**:
   - `PYTHON_VERSION`: `3.11.9`
   - `DATABASE_URL`: `postgresql+asyncpg://postgres:[PASSWORD]@db.ofknpvaxynvokuzfkwds.supabase.co:5432/postgres`
   - `SUPABASE_URL`: `https://ofknpvaxynvokuzfkwds.supabase.co`
   - `SUPABASE_KEY`: `sb_publishable_dFi-FFNPjCd77jj708hhNQ_xKts43nk`
   - `SECRET_KEY`: `your-random-secure-secret-key-2026`
   - `APP_NAME`: `AI Surveillance System`
5. Click **Create Web Service**. Your backend will be live at `https://your-service-name.onrender.com`!

---

### ▲ Deploy Frontend to Vercel

1. Log in to [Vercel.com](https://vercel.com) and click **Add New...** → **Project**.
2. Select your repository `SURVILENCE-SYSTEM-NEW_CODE`.
3. Configure settings:
   - **Root Directory**: `frontend`
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Add **Environment Variables**:
   - `VITE_API_URL`: `https://your-service-name.onrender.com`
5. Click **Deploy**. Vercel will build the frontend and deploy it with full SPA routing (`vercel.json`).

---

## 📁 Directory Structure

```text
SURVILENCE-SYSTEM-NEW_CODE/
├── backend/
│   ├── alembic/                         # Database schema migration scripts
│   │   └── versions/                    # Migration revisions
│   ├── app/
│   │   ├── api/v1/                      # Versioned REST & WebSocket routers
│   │   │   ├── detection.py             # Detection status & active tracks
│   │   │   ├── zones.py                 # Camera ROI polygon zones
│   │   │   ├── vehicles.py              # ANPR license plate scanner
│   │   │   ├── events.py                # Security incidents, Groq Vision & Review Queue
│   │   │   ├── attendance.py            # Biometric attendance records
│   │   │   ├── employees.py             # Employee profile management
│   │   │   ├── cameras.py               # Camera stream management
│   │   │   └── websockets.py            # WebSocket subscriptions
│   │   ├── core/                        # FrameHub, CameraManager, YOLO Plugin, Tracker
│   │   ├── models/                      # Async SQLAlchemy ORM Models
│   │   ├── repositories/                # Async Database Repositories
│   │   ├── schemas/                     # Pydantic Request/Response DTOs
│   │   └── services/                    # Detection Pipeline, Evidence, Groq Verifier
│   ├── tests/                           # Automated Pytest unit & integration test suite
│   ├── requirements.txt                 # Backend Python dependencies
│   └── yolov8n.pt                       # YOLOv8 neural network model
├── frontend/
│   ├── src/
│   │   ├── components/                  # Reusable UI components & layout navigation
│   │   ├── pages/                       # Dashboard, Vehicles, Objects, ReviewQueue, Attendance, LiveView
│   │   ├── lib/                         # Axios API client setup
│   │   └── utils/                       # Styling & class helper functions
│   ├── package.json                     # Frontend dependencies
│   └── vite.config.ts                   # Vite build configuration
├── .gitignore                           # Git ignore rules
└── README.md                            # Comprehensive system documentation
```

---

## 🔒 Security & Privacy

- **Secret Isolation**: Secrets (`GROQ_API_KEY`, `SECRET_KEY`) are loaded strictly from `.env` and never committed to version control.
- **Tenant Isolation**: Multi-tenant authorization enforces tenant boundaries across all queries and WebSockets.
- **Safe AI Fallback**: Groq Vision is strictly invoked on confirmed security triggers, avoiding quota overuse and protecting system throughput.

---

<div align="center">
  <sub>Built with precision • Enterprise AI Surveillance Platform</sub>
</div>
