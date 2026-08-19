<div align="center">
  <br />
  <img src="https://img.icons8.com/?size=512&id=v9pIqV60v1mO&format=png" alt="AI Surveillance Logo" width="130" />
  <br />
  <br />

  <h1>🛡️ <strong>AI Surveillance & Smart Analytics System</strong></h1>
  <p>
    <strong>Enterprise-Grade Real-Time Video Monitoring, AI Object Detection, Attendance & Facial Recognition Platform</strong>
  </p>
  
  <p>
    <a href="https://fastapi.tiangolo.com/"><img src="https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" /></a>
    <a href="https://react.dev/"><img src="https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React 19" /></a>
    <a href="https://vitejs.dev/"><img src="https://img.shields.io/badge/Vite_8-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E" alt="Vite 8" /></a>
    <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/Tailwind_CSS_v4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS v4" /></a>
    <a href="https://sqlite.org/"><img src="https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite" /></a>
    <a href="https://ultralytics.com/"><img src="https://img.shields.io/badge/YOLOv8-FF1493?style=for-the-badge&logo=yolo&logoColor=white" alt="YOLOv8" /></a>
  </p>

  <p>
    <a href="#-overview">Overview</a> •
    <a href="#-key-features">Features</a> •
    <a href="#-architecture">Architecture</a> •
    <a href="#-api-reference">API Reference</a> •
    <a href="#-quick-start">Quick Start</a> •
    <a href="#-directory-structure">Directory Structure</a>
  </p>
</div>

---

## 📖 Overview

The **AI Surveillance System** is an end-to-end, high-performance security and automated attendance monitoring platform. It combines a high-throughput **FastAPI** backend with a responsive **React 19 (Vite)** dashboard. 

The platform turns standard RTSP/CCTV streams into actionable intelligence—detecting objects, recognizing registered personnel, tracking daily attendance logs, and raising automated incident alerts in real time.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│    📹 RTSP Streams ──► 🧠 YOLOv8 & Face-API ──► ⚡ Real-Time Engine   │
│                                                       │                 │
│                                                       ▼                 │
│    📊 Live Dashboard ◄── 🔐 Multi-Tenant API ◄── 💾 Async Database    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## ✨ Key Features

| Category | Feature | Description |
| :--- | :--- | :--- |
| 🪪 **Smart Attendance** | **Biometric Attendance Tracking** | Automatic detection & logging of employees with entry/exit timestamps, confidence ratings, and daily summary statistics. |
| 🧑‍🦲 **Facial Recognition** | **Edge & Server Face Matching** | Client-side edge processing via `face-api.js` paired with backend employee profile matching. |
| 👁️ **AI Detection** | **YOLOv8 Real-Time Inference** | Instant object classification (People, Vehicles, Unauthorized Items) with low latency. |
| 🏢 **Multi-Tenancy** | **Isolated Data Architecture** | Strict hierarchy support (`Tenant` ➔ `Site` ➔ `Camera` ➔ `User Roles`). |
| ⚡ **Rule Engine** | **Automated Alerts & Triggers** | Custom security triggers (e.g. Restricted Zone Access, Off-hours Intrusion). |
| 📊 **Analytics** | **Interactive Visualization** | Real-time charts powered by `Recharts` for attendance counts, footfall, and security events. |

---

## 🛠️ Tech Stack

### Backend (Python Service)
- **Framework**: `FastAPI 0.110+` (ASGI, Async native)
- **Database & ORM**: `SQLAlchemy 2.0` (Async SQLite/PostgreSQL) & `Alembic` for schema migrations
- **AI Engines**: `Ultralytics YOLOv8` (`yolov8n.pt`)
- **Authentication**: JWT Tokens with OAuth2 password flow & `passlib` (Bcrypt)

### Frontend (Client Portal)
- **Framework**: `React 19` + `Vite 8`
- **Styling**: `Tailwind CSS v4` + `Lucide React` icons
- **State & Data**: `Axios` + `React Router v7`
- **Face AI Engine**: `face-api.js` for on-device edge recognition

---

## 📡 API Reference Summary

The backend exposes fully asynchronous OpenAPI / REST endpoints:

| Module | Method | Endpoint | Description |
| :--- | :--- | :--- | :--- |
| **Auth** | `POST` | `/api/v1/auth/token` | Obtain OAuth2 JWT Access Token |
| **Auth** | `GET` | `/api/v1/auth/me` | Get current authenticated user details |
| **Tenants** | `GET` / `POST` | `/api/v1/tenants` | List or create tenant organizations |
| **Sites** | `GET` / `POST` | `/api/v1/sites` | Manage physical sites within tenants |
| **Cameras** | `GET` / `POST` | `/api/v1/cameras` | Register and manage IP camera streams |
| **Employees** | `GET` / `POST` | `/api/v1/employees` | List and register employees for attendance |
| **Attendance** | `GET` | `/api/v1/attendance` | Retrieve filtered attendance records |
| **Attendance** | `POST` | `/api/v1/attendance` | Create/sync attendance log entry |
| **Events** | `GET` | `/api/v1/events` | Fetch system alert events & detection logs |

🔥 *Interactive Swagger UI available at: `http://localhost:8000/docs`*

---

## 🚀 Quick Start

### Prerequisites
- **Python**: `3.12+`
- **Node.js**: `20+` & `npm`

### 1. Launch Backend Server

```bash
# Navigate to backend directory
cd backend

# Initialize & activate virtual environment (Windows)
python -m venv venv
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run database migrations
alembic upgrade head

# Start FastAPI server
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Launch Frontend Server

```bash
# Open a new terminal and navigate to frontend directory
cd frontend

# Install Node packages
npm install

# Start Vite dev server
npx vite --host 0.0.0.0
```

Access the UI at: 👉 **[http://localhost:5173](http://localhost:5173)**

---

## 🏗️ Directory Structure

```text
📦 AI SURVILLENCE SYSTEM
 ├── 📂 backend/                      # FastAPI Backend Workspace
 │   ├── 📂 alembic/                  # Database schema migration scripts
 │   ├── 📂 app/                      # Application Domain Logic
 │   │   ├── 📂 api/v1/               # Endpoint Routers (Auth, Attendance, Cameras, etc.)
 │   │   ├── 📂 core/                 # Config, Security, Rules, Websockets
 │   │   ├── 📂 models/               # SQLAlchemy Models (User, Employee, Attendance, etc.)
 │   │   ├── 📂 repositories/         # Async Database Abstraction Repositories
 │   │   ├── 📂 schemas/              # Pydantic Request & Response Validation
 │   │   └── 📂 services/             # Business Logic & Orchestration Layer
 │   ├── 📜 ai_surveillance.db        # SQLite Database Instance
 │   ├── 📜 test_attendance.py        # Automated API Verification Script
 │   └── 📜 requirements.txt          # Python Package Requirements
 │
 ├── 📂 frontend/                     # React 19 Client Workspace
 │   ├── 📂 public/                   # Face Recognition Weights & Assets
 │   ├── 📂 src/                      # React Application Source
 │   │   ├── 📂 components/           # Reusable UI Elements & Modals
 │   │   ├── 📂 lib/                  # Axios Client & Helper Utilities
 │   │   ├── 📂 pages/                # Page Views (Dashboard, Attendance, Live, Objects)
 │   │   └── 📂 utils/                # Styling Helpers (`cn` utility)
 │   ├── 📜 package.json              # Frontend Node Dependencies
 │   └── 📜 vite.config.ts            # Vite Configuration
 │
 └── 📜 README.md                     # You Are Here
```

---

<div align="center">
  <sub>Built with ❤️ for advanced security and automated intelligence.</sub>
</div>
