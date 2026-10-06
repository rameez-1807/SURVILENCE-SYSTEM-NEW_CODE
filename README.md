<div align="center">

  <br />

  <img src="https://img.icons8.com/?size=512&id=v9pIqV60v1mO&format=png" alt="AI Surveillance Logo" width="110" />

  <br />
  <br />

  <h1>🛡️ <strong>AI SURVEILLANCE & REAL-TIME INTELLIGENCE PLATFORM</strong></h1>

  <p>
    <strong>Enterprise Real-Time Video Analytics • YOLOv8 Multi-Object Detection • ByteTrack Tracking • ANPR Plate Scanner • Groq Vision AI • Human Review Queue • Biometric Face Attendance</strong>
  </p>

  <p>
    <a href="https://github.com/rameez-1807/SURVILENCE-SYSTEM-NEW_CODE.git"><img src="https://img.shields.io/badge/GitHub-Repository-181717?style=for-the-badge&logo=github&logoColor=white" alt="GitHub Repo" /></a>
    <a href="https://fastapi.tiangolo.com/"><img src="https://img.shields.io/badge/FastAPI-0.115+-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" /></a>
    <a href="https://react.dev/"><img src="https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React 19" /></a>
    <a href="https://vitejs.dev/"><img src="https://img.shields.io/badge/Vite_8-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite 8" /></a>
    <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/Tailwind_CSS_v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS v4" /></a>
    <a href="https://ultralytics.com/"><img src="https://img.shields.io/badge/YOLOv8-Ultralytics-00599C?style=for-the-badge&logo=yolo&logoColor=white" alt="YOLOv8" /></a>
    <a href="https://groq.com/"><img src="https://img.shields.io/badge/Groq_Vision_AI-F55036?style=for-the-badge&logo=groq&logoColor=white" alt="Groq Vision AI" /></a>
    <a href="https://supabase.com/"><img src="https://img.shields.io/badge/Supabase_/_PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase / PostgreSQL" /></a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square" alt="PRs Welcome" />
    <img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square" alt="License" />
    <img src="https://img.shields.io/badge/Status-Production--Ready-success?style=flat-square" alt="Status" />
    <img src="https://img.shields.io/badge/Architecture-DDD_%2B_Microservices-orange?style=flat-square" alt="Architecture" />
  </p>

  <br />

  <p>
    <a href="#-system-overview">Overview</a> •
    <a href="#-key-features">Key Features</a> •
    <a href="#-system-architecture">Architecture</a> •
    <a href="#-ui-design--components">UI & Theme System</a> •
    <a href="#-feature-comparison-matrix">Feature Matrix</a> •
    <a href="#-api-reference">API Reference</a> •
    <a href="#-quick-start">Quick Start</a> •
    <a href="#-deployment-guide">Deployment</a>
  </p>

</div>

---

## 📖 System Overview

The **AI Surveillance System** is an enterprise-grade, high-performance security intelligence platform built to monitor, detect, track, and alert across multiple camera streams in real time. 

Engineered with an asynchronous Python backend (**FastAPI + SQLAlchemy 2.0 Async + WebSockets**) and a reactive glassmorphic frontend (**React 19 + TypeScript + Tailwind CSS v4**), the platform seamlessly orchestrates:

* 🎯 **Sub-Millisecond Inference**: YOLOv8 neural network inference with GPU acceleration (`CUDA`) and CPU fallback.
* 🛰️ **Deterministic Object Tracking**: ByteTrack persistent identity tracking (`track_id`) across consecutive video frames.
* 🛡️ **Interactive ROI Security Zones**: Polygon ray-casting algorithm to detect perimeter breaches and loitering.
* 🚗 **ANPR License Plate Scanner**: Real-time vehicle license plate extraction with OpenCV contour analysis and Tesseract OCR.
* 🧠 **Groq Multimodal Vision Engine**: Secondary verification using Groq's high-speed multimodal LLM (`qwen/qwen3.6-27b`).
* 📝 **Human-in-the-Loop Review Queue**: Dedicated audit queue for security personnel to inspect flagged events and correct labels.
* 🪪 **Biometric Facial Attendance**: In-browser edge neural facial recognition (`face-api.js`) with employee directory and daily logs.
* 🎨 **Theme Engine & Glassmorphism UI**: Dynamic Dark/Light theme switching, rich glass surfaces, telemetry sparklines, and responsive layout.

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph Video_Ingestion["📹 Camera & Video Ingestion"]
        RTSP["CCTV / RTSP Stream"] --> Worker["CaptureWorker (OpenCV)"]
        Webcam["Live USB / Webcam"] --> Worker
        Worker --> Hub["FrameHub (Bounded Pub-Sub Buffer)"]
    end

    subgraph AI_Engine["🧠 AI & Vision Pipeline"]
        Hub --> YOLO["YOLOv8 Object Detector (CUDA / CPU)"]
        YOLO --> Tracker["ByteTrack Multi-Object Tracker (Stable track_id)"]
        Tracker --> Confirm["Temporal Filter (N-Frames Confirmation)"]
        Confirm --> Zones["ROI & Security Detection Zones"]
        Zones --> Cooldown["Cooldown Debouncer"]
        Cooldown --> Snapshot["Evidence Snapshot Generator"]
        Snapshot -.-> Groq["Groq Vision API (Qwen 3.6 27B Verification)"]
    end

    subgraph Persistence_Messaging["💾 Persistence & Real-Time Sync"]
        Cooldown --> EventEngine["Rules & Event Engine"]
        EventEngine --> DB[(Supabase / PostgreSQL / SQLite Async)]
        EventEngine --> WS["WebSocket Broadcaster"]
    end

    subgraph Frontend_App["📊 Modern React 19 UI Portal"]
        WS --> UI["Live Dashboard & Telemetry"]
        DB --> UI
        UI --> ANPR_UI["🚗 ANPR Vehicle Scanner (/vehicles)"]
        UI --> Obj_UI["🎯 Object Tracking & Scanner (/objects)"]
        UI --> Review_UI["📝 Human Review Queue (/review-queue)"]
        UI --> Att_UI["🪪 Biometric Face Attendance (/attendance)"]
        UI --> Cam_UI["📹 Camera Grid & Health (/cameras, /health)"]
        UI --> Analytics_UI["📈 Real-time Analytics (/analytics)"]
    end
```

---

## ✨ Key Features & Modules

### 1. 🎯 Real-Time Object Detection & ByteTrack Tracking (`/objects`)
- **Singleton Model Lifecycle**: Weights loaded once during application startup for maximum inference throughput.
- **Hardware Agnostic**: Automatic GPU detection (`CUDA`) with seamless CPU zero-copy fallback (`torch.no_grad()`).
- **Temporal Stability**: ByteTrack algorithm guarantees stable tracking IDs even during occlusions.
- **Debounced Alarms**: Configurable per-track cooldown timers prevent duplicate notifications.
- **Annotated Evidence**: Saves timestamped, bounding-boxed frames to `/evidence/snapshots/`.

### 2. 🚗 ANPR Vehicle License Plate Scanner (`/vehicles`)
- **Dual Mode**: Process live camera feeds or upload high-resolution vehicle imagery.
- **Smart Plate Formatting**: Custom regex filters tailored for vehicle registration plates (e.g. `JH03MF4477`, `UP16BT4321`).
- **Voice Announcements**: Built-in speech synthesis toggle (`🔊 Voice Announcement ON / OFF`) announcing detected license plates.
- **Historical Records**: Searchable database records with filters, status badges, and CSV export.

### 3. ⚡ Groq Multimodal Vision Engine (`/events/vision-scan`)
- **High-Speed Multimodal Intelligence**: Secondary verification powered by Groq's `qwen/qwen3.6-27b` multimodal model.
- **Intelligent Focus**: Focuses on foreground security items (**Smartphones**, **Keys**, **Badges**, **Laptops**, **Weapons**).
- **Background Noise Suppression**: Ignores background clutter (**Walls**, **Chairs**, **Doors**).
- **Thinking Tag Sanitization**: Automatically removes internal `<think>` reasoning tokens to return clean 1-3 word classifications.

### 4. 📝 Human-in-the-Loop Review Queue (`/review-queue`)
- **Audit Flagged Incidents**: Events with low AI confidence or boundary ambiguity are routed for human verification.
- **One-Click Label Correction**: Security officers can confirm or reclassify objects in real time (`PATCH /api/v1/events/{id}/correct-label`).
- **Continuous Feedback**: Updated labels persist instantly to the database for model fine-tuning.

### 5. 🪪 Biometric Facial Attendance (`/attendance`)
- **Client-Side Neural Recognition**: High-accuracy facial feature vector extraction using Face-API.js.
- **Employee Roster**: Register employee profiles with reference facial landmarks.
- **Automated Check-in / Check-out**: Automatic logging of entry/exit timestamps with confidence metrics.
- **Daily Analytics**: Aggregated attendance reports with search and department filtering.

### 6. 🎨 Premium UI Design System & Theming
- **Dual Theme Support**: Comprehensive Dark / Light mode with persistent state via `ThemeContext`.
- **Glassmorphism Aesthetic**: Modern translucent cards, border glows, and curated color palettes.
- **Micro-Animations**: Smooth hover transitions, live radar scanner effects, and pulse indicators.
- **Modular Component Library**: Standardized components (`AlertCard`, `Badge`, `CameraCard`, `EmptyState`, `LoadingState`, `PageHeader`, `StatCard`).

---

## 📊 Feature Comparison Matrix

| Feature | Standard CCTV | Traditional NVR | 🛡️ Our AI Surveillance System |
|:---|:---:|:---:|:---:|
| **Detection Method** | Motion Pixels | Simple Motion | ✅ **YOLOv8 Deep Neural Network (640px)** |
| **Object Tracking** | ❌ None | ❌ None | ✅ **ByteTrack Persistent Identity (`track_id`)** |
| **False Positive Filter** | ❌ None | ⚠️ Basic Masking | ✅ **Temporal N-Frame Confirmation Filter** |
| **License Plate OCR** | ❌ None | ⚠️ High Cost | ✅ **Built-in ANPR + Contour Extraction** |
| **Multimodal AI Verification**| ❌ None | ❌ None | ✅ **Groq Vision AI (`qwen/qwen3.6-27b`)** |
| **Human Review Queue** | ❌ None | ❌ None | ✅ **Interactive Label Correction Interface** |
| **Biometric Attendance** | ❌ Separate Device | ❌ Separate Device | ✅ **Integrated Edge Neural Face-API.js** |
| **Real-time Live Sync** | ❌ Polling | ⚠️ RTSP Lag | ✅ **WebSockets + Low-Latency Canvas Stream** |
| **Theme & UI** | ❌ Legacy Gray UI | ❌ Legacy Gray UI | ✅ **React 19 + Glassmorphism Dark/Light Theme** |

---

## 🛠️ Technology Stack

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 TECHNOLOGY STACK                                       │
├──────────────────┬─────────────────────────────────────────────────────────────────────┤
│ Backend Runtime  │ Python 3.12+, FastAPI, Uvicorn, Pydantic v2, Asyncio                │
│ Database Engine  │ SQLAlchemy 2.0 (Async), Alembic, Supabase / PostgreSQL, SQLite      │
│ Computer Vision  │ OpenCV (Headless), Ultralytics YOLOv8, Supervision (ByteTrack)      │
│ AI / Multimodal  │ Groq Vision API (Qwen 3.6 27B), PyTorch, Torchvision                │
│ Biometrics / OCR │ Face-API.js, Tesseract.js, EasyOCR                                  │
│ Frontend Portal  │ React 19, TypeScript, Vite 8, Tailwind CSS v4, Lucide Icons        │
│ UI Components    │ Custom Glassmorphism Component Library, Recharts Analytics          │
│ Protocol / Sync  │ WebSockets, RESTful JSON API, Cross-Origin Isolation                │
└──────────────────┴─────────────────────────────────────────────────────────────────────┘
```

---

## 📡 API Reference

### 🎯 Detection & Telemetry
| Method | Endpoint | Description |
|:---|:---|:---|
| `GET` | `/api/v1/detection/status` | Live pipeline health, FPS, latency (avg/P95), GPU VRAM, active tracks |
| `GET` | `/api/v1/detection/cameras/{id}/tracks` | List currently active tracked targets with bounding boxes |
| `GET` | `/api/v1/detection/cameras/{id}/detections` | Get raw detections for the latest camera frame |

### 🛡️ ROI Detection Zones
| Method | Endpoint | Description |
|:---|:---|:---|
| `GET` | `/api/v1/zones/camera/{camera_id}` | Retrieve all polygon detection zones configured for a camera |
| `POST` | `/api/v1/zones` | Create a new normalized polygon detection zone |
| `PATCH` | `/api/v1/zones/{zone_id}` | Update coordinates or sensitivity of a detection zone |
| `DELETE`| `/api/v1/zones/{zone_id}` | Remove a detection zone |

### 🚗 ANPR Vehicles & Security Events
| Method | Endpoint | Description |
|:---|:---|:---|
| `POST` | `/api/v1/vehicles/scan` | Ingest vehicle image frame, run OCR, and persist record |
| `GET` | `/api/v1/vehicles` | List all logged vehicle detection records |
| `DELETE`| `/api/v1/vehicles` | Clear all vehicle history logs |
| `POST` | `/api/v1/events/vision-scan` | Perform secondary semantic Groq Vision multimodal scan |
| `GET` | `/api/v1/events` | List recorded security events and incident alerts |
| `GET` | `/api/v1/events/review-queue` | Retrieve events flagged for human review |
| `PATCH` | `/api/v1/events/{id}/correct-label` | Submit human correction for an event label |
| `DELETE`| `/api/v1/events/clear-all` | Purge all stored security events |
| `WS` | `/api/v1/ws` | Bi-directional WebSocket stream for real-time notifications |

---

## 🚀 Quick Start

### Prerequisites
- **Python**: `3.12+` installed
- **Node.js**: `18+` & `npm` installed
- **Git**: Installed and configured

---

### Step 1: Clone Repository
```bash
git clone https://github.com/rameez-1807/SURVILENCE-SYSTEM-NEW_CODE.git
cd SURVILENCE-SYSTEM-NEW_CODE
```

---

### Step 2: Backend Setup
```bash
cd backend

# Create & activate virtual environment
# Windows (PowerShell):
python -m venv ../venv
..\venv\Scripts\Activate.ps1

# Linux / macOS:
# python -m venv ../venv && source ../venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run migrations (Optional / if using Supabase or PostgreSQL)
alembic upgrade head

# Start FastAPI server
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

---

### Step 3: Frontend Setup
```bash
# Open a separate terminal window
cd frontend

# Install dependencies
npm install

# Start Vite dev server
npm run dev
```

---

### Step 4: Access System
- 🌐 **Web Dashboard**: `http://localhost:5173`
- 📚 **Swagger Docs**: `http://127.0.0.1:8000/docs`
- 📖 **ReDoc Docs**: `http://127.0.0.1:8000/redoc`

---

## 🚀 Deployment Guide

### 🟣 Deploy Backend to Render

1. Log in to [Render.com](https://render.com) and click **New +** → **Web Service**.
2. Connect your GitHub repository: `https://github.com/rameez-1807/SURVILENCE-SYSTEM-NEW_CODE.git`.
3. Configure settings:
   - **Root Directory**: `backend`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Add **Environment Variables**:
   - `PYTHON_VERSION`: `3.11.9`
   - `DATABASE_URL`: `postgresql+asyncpg://postgres:[PASSWORD]@db.ofknpvaxynvokuzfkwds.supabase.co:5432/postgres`
   - `SUPABASE_URL`: `https://ofknpvaxynvokuzfkwds.supabase.co`
   - `SUPABASE_KEY`: `your-supabase-publishable-key`
   - `SECRET_KEY`: `your-random-secure-secret-key-2026`
   - `GROQ_API_KEY`: `your-groq-api-key` (optional, for Groq Vision)
5. Click **Create Web Service**.

---

### ▲ Deploy Frontend to Vercel

1. Log in to [Vercel.com](https://vercel.com) and click **Add New...** → **Project**.
2. Import your GitHub repository: `SURVILENCE-SYSTEM-NEW_CODE`.
3. Configure project settings:
   - **Root Directory**: `frontend`
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Add **Environment Variables**:
   - `VITE_API_URL`: `https://your-backend-service.onrender.com`
   - `VITE_SUPABASE_URL`: `https://your-project.supabase.co`
   - `VITE_SUPABASE_ANON_KEY`: `your-supabase-anon-key`
5. Click **Deploy**.

---

## 📁 Project Structure

```text
SURVILENCE-SYSTEM-NEW_CODE/
├── backend/
│   ├── alembic/                         # Database schema migrations
│   ├── app/
│   │   ├── api/v1/                      # Versioned API route handlers
│   │   │   ├── attendance.py            # Face attendance records
│   │   │   ├── cameras.py               # Camera stream management
│   │   │   ├── detection.py             # Telemetry & tracking status
│   │   │   ├── employees.py             # Employee profiles
│   │   │   ├── events.py                # Security events & Groq Vision
│   │   │   ├── vehicles.py              # ANPR license plate scanner
│   │   │   ├── websockets.py            # Real-time WebSocket hub
│   │   │   └── zones.py                 # Polygon detection zones
│   │   ├── core/                        # FrameHub, YOLO Plugin, Security
│   │   ├── models/                      # SQLAlchemy ORM models
│   │   ├── repositories/                # Database query repositories
│   │   ├── schemas/                     # Pydantic request / response schemas
│   │   └── services/                    # Pipeline, Evidence, Groq Verifier
│   ├── requirements.txt                 # Backend Python dependencies
│   └── yolov8n.pt                       # YOLOv8 base model weights
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/                  # AppLayout, Header, Sidebar
│   │   │   └── ui/                      # StatCard, AlertCard, Badge, PageHeader, etc.
│   │   ├── context/                     # ThemeContext (Dark/Light mode)
│   │   ├── pages/                       # Dashboard, Live, Vehicles, Objects,
│   │   │                                # ReviewQueue, Attendance, Cameras, Analytics, etc.
│   │   ├── lib/                         # Supabase & Axios API clients
│   │   ├── index.css                    # Tailwind CSS v4 design tokens & utilities
│   │   └── main.tsx                     # React application entry point
│   ├── package.json                     # Frontend dependencies
│   └── vite.config.ts                   # Vite configuration
├── .gitignore                           # Git ignore rules
└── README.md                            # Complete documentation
```

---

## 🔒 Security & Privacy

* **Zero Committed Secrets**: `.env` files are strictly excluded via `.gitignore`.
* **Tenant Isolation**: Row-Level Security (RLS) and multi-tenant scoped DB queries prevent cross-tenant data leaks.
* **On-Demand Multimodal Calls**: Groq Vision is strictly triggered on confirmed detections to preserve API quotas and ensure low latency.

---

<div align="center">
  <sub>Crafted with ❤️ for Next-Generation Security Intelligence • AI Surveillance System</sub>
</div>
