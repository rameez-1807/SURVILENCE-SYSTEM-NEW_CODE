<div align="center">
  <br />
  <img src="https://img.icons8.com/?size=512&id=v9pIqV60v1mO&format=png" alt="AI Surveillance Logo" width="130" />
  <br />
  <br />

  <h1>🛡️ <strong>AI Surveillance, ANPR License Plate & Groq Vision System</strong></h1>
  <p>
    <strong>Enterprise-Grade Real-Time Video Security, Automatic License Plate Recognition (ANPR), Groq AI Multimodal Vision & Biometric Attendance Platform</strong>
  </p>

  <p>
    <a href="https://github.com/rameez-1807/SURVILENCE-SYSTEM-NEW_CODE.git"><img src="https://img.shields.io/badge/GitHub-Repository-181717?style=for-the-badge&logo=github&logoColor=white" alt="GitHub Repo" /></a>
    <a href="https://fastapi.tiangolo.com/"><img src="https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" /></a>
    <a href="https://groq.com/"><img src="https://img.shields.io/badge/Groq_Vision_AI-f55036?style=for-the-badge&logo=groq&logoColor=white" alt="Groq Vision AI" /></a>
    <a href="https://react.dev/"><img src="https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React 19" /></a>
    <a href="https://vitejs.dev/"><img src="https://img.shields.io/badge/Vite_8-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E" alt="Vite 8" /></a>
    <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/Tailwind_CSS_v4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS v4" /></a>
    <a href="https://sqlite.org/"><img src="https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite" /></a>
  </p>

  <p>
    <a href="#-overview">Overview</a> •
    <a href="#-key-modules--features">Modules & Features</a> •
    <a href="#-tech-stack">Tech Stack</a> •
    <a href="#-api-reference">API Reference</a> •
    <a href="#-quick-start">Quick Start</a> •
    <a href="#-directory-structure">Directory Structure</a>
  </p>
</div>

---

## 📖 Overview

The **AI Surveillance System** is an end-to-end, high-performance security monitoring, **Automatic License Plate Recognition (ANPR)**, **Groq Multimodal AI Vision**, and **Biometric Attendance** platform.

It combines a high-throughput **FastAPI** backend with a modern, responsive **React 19 (Vite + Tailwind CSS v4)** dashboard. The platform turns standard RTSP/CCTV/Webcam streams into real-time intelligence—extracting car number plates, identifying small handheld objects with Groq Vision LLM, logging employee attendance, and recording incident evidence permanently into an SQLite database.

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                        │
│   📹 Live CCTV Streams ──► 🚗 ANPR OCR & Groq Vision AI ──► ⚡ Real-Time Engine       │
│                                                                  │                     │
│                                                                  ▼                     │
│   📊 Dashboard Portal  ◄── 🔐 Multi-Tenant API        ◄── 💾 Permanent SQLite DB      │
│                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## ✨ Key Modules & Features

### 🚗 1. ANPR Vehicle License Plate Scanner & DB Recorder (`/vehicles`)
- **Live ANPR Camera & Photo Upload Scanner**: Real-time license plate extraction using OpenCV contour geometry and Tesseract OCR.
- **Indian License Plate Badges**: Visual yellow plate badges (`JH03MF4477`, `UP16BT4321`) with location spot tagging (`📍 Apartment Parking`, `Apartment Main Entrance`).
- **Side-by-Side Dashboard Layout**: 1-to-1 visual grid structure matching the Objects scanner (Left: Live Camera/Photo Upload Scanner & Database Summary Card; Right: License Plate History Table, Search/Filter Toolbar, and Vehicle Details Modal).
- **Interactive Voice Announcement Toggle**: Top header pill button (`🔊 Voice Announcement ON` / `🔇 Voice Announcement OFF`) with instant Web Speech Synthesis cancellation.
- **Permanent SQLite DB Recorder**: Automated API persistence via `/api/v1/vehicles/scan` and Instant Plate Quick Register bar.
- **Clear History Action**: One-click wipe for all vehicle history records via `DELETE /api/v1/vehicles`.

---

### ⚡ 2. Groq AI Multimodal Object Scanner (`/objects`)
- **Groq Vision API Integration**: Powered by Groq AI API (`GROQ_API_KEY`) and the `qwen/qwen3.6-27b` Multimodal Vision LLM.
- **High-Precision Small Object Detection**: Accurately identifies small handheld items (**Computer Mouse**, **Pen / Marker**, **Smartphone**, **Laptop**, **Water Bottle**, **Reading Glasses**, **Coffee Mug**, **Key Ring**) in ~0.2 seconds.
- **Background Furniture Suppression**: Automatically suppresses background room clutter (`chair`, `tv`, `sofa`, `bed`, `door`, `traffic light`) to prioritize foreground objects.
- **Clean Title Sanitizer**: Automated Regex engine (`re.sub(r'<think>.*?</think>', '', ...)`) that strips internal thinking tags and returns clean 1-3 word object titles.
- **Pen & Office Mode Toggle**: Dedicated `🖋️ Pen & Office Mode ON` high-precision toggle.
- **One-Click Clear History**: Wipe all object detection events via `DELETE /api/v1/events/clear-all`.

---

### 🪪 3. Biometric Facial Recognition & Attendance Platform (`/attendance`, `/recognition-analytics`, `/recognition-history`)
- **Face-API.js Edge Recognition**: On-device face detection and descriptor extraction offloaded to client browser using neural network weights in `public/models/`.
- **Employee Biometric Profiles**: Employee registration modals, check-in & check-out time tracking, confidence ratings, and department tags.
- **Analytics & History**: Interactive trend charts powered by `Recharts` for daily footfall, attendance logs, and facial recognition analytics.

---

### 🏢 4. Multi-Tenant Architecture & Security Rule Engine (`/cameras`, `/live`, `/events`)
- **Organizational Hierarchy**: Strict multi-tenant isolation (`Tenant` ➔ `Site` ➔ `Camera` ➔ `User Roles`).
- **Multi-Camera Stream Grid**: Real-time RTSP/WebRTC multi-camera grid monitoring.
- **Security Incident Triggers**: Configurable security event rules, evidence snapshot viewer, and severity filters.

---

## 🛠️ Tech Stack

### Backend (Python Service)
- **Framework**: `FastAPI 0.110+` (ASGI, Async native)
- **AI & Vision Engines**: `Groq API` (Qwen 27B Vision), `OpenCV`, `Tesseract OCR`
- **Database & ORM**: `SQLAlchemy 2.0` (Async SQLite/PostgreSQL) & `Alembic` schema migrations
- **Authentication**: OAuth2 JWT Tokens with `passlib` (Bcrypt)

### Frontend (Client Portal)
- **Framework**: `React 19` + `Vite 8` + `TypeScript 5`
- **Styling**: `Tailwind CSS v4` + `Lucide React` Icons
- **Edge AI**: `face-api.js` for client-side face recognition
- **Data & Charts**: `Axios` + `Recharts` + `React Router v7`

---

## 📡 API Reference Summary

| Module | Method | Endpoint | Description |
| :--- | :--- | :--- | :--- |
| **Auth** | `POST` | `/api/v1/auth/token` | Obtain OAuth2 JWT Access Token |
| **ANPR Vehicles** | `GET` | `/api/v1/vehicles` | List scanned vehicle records with filters |
| **ANPR Vehicles** | `POST` | `/api/v1/vehicles/scan` | Scan license plate & save to SQLite DB |
| **ANPR Vehicles** | `DELETE` | `/api/v1/vehicles` | Clear all vehicle history records |
| **Groq AI Vision**| `POST` | `/api/v1/events/vision-scan` | Multimodal Vision object detection via Groq API |
| **Objects/Events** | `GET` | `/api/v1/events` | Retrieve object detection events |
| **Objects/Events** | `DELETE` | `/api/v1/events/clear-all` | Clear all object detection history |
| **Employees** | `GET` / `POST` | `/api/v1/employees` | Manage employee biometric profiles |
| **Attendance** | `GET` / `POST` | `/api/v1/attendance` | Log and retrieve biometric attendance |

🔥 *Interactive OpenAPI Swagger UI available at: `http://localhost:8000/docs`*

---

## 🚀 Quick Start

### Prerequisites
- **Python**: `3.12+`
- **Node.js**: `20+` & `npm`
- **Groq API Key**: (Optional, for Vision AI) `GROQ_API_KEY=gsk_...`

### 1. Configure & Start Backend Server

```bash
# Navigate to backend directory
cd backend

# Create & activate virtual environment (Windows)
python -m venv venv
venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt

# Run database migrations
alembic upgrade head

# Start FastAPI uvicorn server
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### 2. Configure & Start Frontend Dashboard

```bash
# Open a new terminal and navigate to frontend
cd frontend

# Install Node dependencies
npm install

# Start Vite dev server
npm run dev
```

Access the Web Portal in your browser:  
👉 **[http://localhost:5173](http://localhost:5173)**

---

## 🏗️ Directory Structure

```text
📦 SURVILENCE-SYSTEM-NEW_CODE
 ├── 📂 backend/                      # FastAPI Backend Service
 │   ├── 📂 alembic/                  # Database migration scripts
 │   ├── 📂 app/                      # Application Logic Layer
 │   │   ├── 📂 api/v1/               # Endpoint Routers (vehicles, events, auth, etc.)
 │   │   ├── 📂 core/                 # Config, Groq API settings, Security
 │   │   ├── 📂 models/               # SQLAlchemy Models (VehicleRecord, Event, etc.)
 │   │   ├── 📂 repositories/         # Database Access Layer
 │   │   ├── 📂 schemas/              # Pydantic Request/Response DTOs
 │   │   └── 📂 services/             # ANPR & Vehicle Business Services
 │   ├── 📜 .env                      # Environment Variables (GROQ_API_KEY)
 │   ├── 📜 ai_surveillance.db        # SQLite Database Instance
 │   └── 📜 requirements.txt          # Python Package Requirements
 │
 ├── 📂 frontend/                     # React 19 Frontend Web Portal
 │   ├── 📂 public/                   # Face-API.js neural network weights
 │   ├── 📂 src/                      # Source Code
 │   │   ├── 📂 components/           # Reusable Components & Modals
 │   │   ├── 📂 lib/                  # Axios API Client (`api.ts`)
 │   │   ├── 📂 pages/                # Primary Views (Vehicles, Objects, Attendance)
 │   │   └── 📂 utils/                # Utility Helpers (`cn.ts`)
 │   ├── 📜 package.json              # NPM Dependencies
 │   └── 📜 vite.config.ts            # Vite Settings
 │
 └── 📜 README.md                     # Project Documentation
```

---

<div align="center">
  <sub>Repository: <a href="https://github.com/rameez-1807/SURVILENCE-SYSTEM-NEW_CODE.git">rameez-1807/SURVILENCE-SYSTEM-NEW_CODE</a> • Designed for Maximum Precision</sub>
</div>
