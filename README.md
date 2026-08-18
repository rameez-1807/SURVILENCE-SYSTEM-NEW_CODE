<div align="center">
  <br />
  <img src="https://img.icons8.com/?size=512&id=v9pIqV60v1mO&format=png" alt="Logo" width="120" />
  <br />

  <h1>🛡️ <strong>AI Surveillance System</strong></h1>
  <p>
    <strong>A Next-Generation, Real-Time Intelligent Video Analytics & Enterprise Surveillance Platform</strong>
  </p>
  
  <p>
    <a href="https://fastapi.tiangolo.com/"><img src="https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi" alt="FastAPI" /></a>
    <a href="https://reactjs.org/"><img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" /></a>
    <a href="https://www.postgresql.org/"><img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" /></a>
    <a href="https://ultralytics.com/"><img src="https://img.shields.io/badge/YOLOv8-FF1493?style=for-the-badge&logo=yolo&logoColor=white" alt="YOLOv8" /></a>
    <a href="https://vitejs.dev/"><img src="https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E" alt="Vite" /></a>
    <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" /></a>
  </p>
  <p>
    <a href="#"><img src="https://img.shields.io/badge/Python-3.12+-blue.svg?style=flat-square&logo=python&logoColor=white" alt="Python Version"></a>
    <a href="#"><img src="https://img.shields.io/badge/Node.js-20+-green.svg?style=flat-square&logo=node.js&logoColor=white" alt="Node Version"></a>
    <a href="#"><img src="https://img.shields.io/badge/License-Proprietary-red.svg?style=flat-square" alt="License"></a>
  </p>

  <p>
    <a href="#-overview">Overview</a> •
    <a href="#-key-features">Features</a> •
    <a href="#%EF%B8%8F-technology-stack">Tech Stack</a> •
    <a href="#-getting-started">Installation</a> •
    <a href="#-architecture--structure">Architecture</a>
  </p>
</div>

---

## 📖 Overview

The **AI Surveillance System** is an enterprise-grade, highly scalable platform designed to transform traditional CCTV monitoring into a smart, proactive, and data-driven ecosystem. 

By seamlessly integrating a robust Python (FastAPI) backend with a stunningly fast React (Vite) frontend, the platform provides real-time monitoring, intelligent object detection, facial recognition, and automated event tracking. Built with multi-tenancy at its core, it enables complex organizational structures (Tenants -> Sites -> Cameras) to be managed effortlessly from a single interface.

> **Our Mission:** To provide unparalleled security insights, automate attendance tracking, and instantly alert on critical incidents through the power of Artificial Intelligence.

---

## ✨ Key Features

Our platform brings a wide array of advanced capabilities structured for enterprise demands:

| Feature | Description |
| :--- | :--- |
| 👁️ **Real-Time AI Inference** | Powered by `YOLOv8` for instant object detection (vehicles, persons, bags) and anomaly detection with minimal latency. |
| 🧑‍🦲 **Advanced Facial Recognition** | Integrated biometric analysis using `face-api.js` and server-side models to automate employee attendance and identify unauthorized personnel. |
| 🏢 **Multi-Tenant Architecture** | A strictly isolated hierarchical data model allowing organizations (Tenants) to manage multiple locations (Sites) and individual streams (Cameras). |
| ⚙️ **Dynamic Rule Engine** | Create custom triggers—like "Alert if a person enters a restricted zone" or "Log attendance when an employee face is recognized". |
| 📊 **Interactive Analytics Dashboard** | Beautiful, data-rich visualizations built with `Recharts` and `Tailwind CSS`, offering immediate insights into footfall, incidents, and daily operations. |
| 🎬 **Live Stream & Evidence Hub** | Effortlessly view live multi-camera grids. Automatically captures and stores high-resolution frames as evidence whenever a critical event is triggered. |

---

## 🛠️ Technology Stack

We've chosen the best-in-class modern tools to guarantee performance, scalability, and an exceptional developer experience.

### 🧠 Backend (The Brain)
- **Core Framework**: `FastAPI` (Python 3.12+) — Ensures high-throughput async processing.
- **Database & ORM**: `PostgreSQL` combined with `SQLAlchemy` (Async) and `Alembic` for migrations.
- **AI Models**: `Ultralytics YOLOv8` (`yolov8n.pt`) and custom Deep Learning modules.
- **WebSockets**: Real-time bi-directional event and frame streaming.
- **Architecture**: Domain-Driven Design (Repositories, Services, Routers).

### 🎨 Frontend (The Canvas)
- **Framework**: `React 19` bootstrapped via `Vite` — Blazing fast hot-module reloading and optimized builds.
- **Styling**: `Tailwind CSS v4` + `Lucide React` — Highly customizable, pixel-perfect UI.
- **State & Data**: `Axios` for robust API fetching and `React Router v7` for smooth transitions.
- **Client AI**: `face-api.js` for on-device edge computing and face recognition offloading.

---

## 📸 Sneak Peek (UI/UX)

*(Replace the placeholders below with actual project screenshots!)*

<div align="center">
  <img src="https://via.placeholder.com/800x450.png?text=Interactive+Dashboard+Screenshot" alt="Dashboard" />
  <p><i>Modern, responsive dashboard tailored for security operation centers.</i></p>
</div>

---

## 🚀 Getting Started

Follow these instructions to get a local development environment running smoothly.

### 📋 Prerequisites
- **Python 3.12+**
- **Node.js 20+**
- **PostgreSQL Server** (Running locally or via Docker)

---

### 1️⃣ Backend Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/rameez-1807/SURVILENCE-SYSTEM-NEW_CODE.git
   cd "AI SURVILLENCE SYSTEM/backend"
   ```

2. **Initialize the Virtual Environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   ```

3. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Environment Configuration:**
   Copy the example config and inject your local database credentials:
   ```bash
   cp .env.example .env
   ```
   *Edit `.env` to match your DB details (Host, Port, User, Password, DB Name).*

5. **Database Initialization:**
   Generate tables and schema via Alembic migrations:
   ```bash
   alembic upgrade head
   ```

6. **Start the API Server:**
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```
   🔥 *Access the interactive Swagger API Docs at: [http://localhost:8000/docs](http://localhost:8000/docs)*

---

### 2️⃣ Frontend Setup

1. **Navigate to the frontend workspace:**
   ```bash
   cd ../frontend
   ```

2. **Install Node dependencies:**
   ```bash
   npm install
   ```

3. **Launch the Development Server:**
   ```bash
   npm run dev
   ```
   ✨ *Experience the beautiful UI at: [http://localhost:5173](http://localhost:5173)*

---

## 🏗️ Architecture & Directory Structure

A clean, modular, and maintainable monorepo layout:

```text
📦 AI SURVILLENCE SYSTEM
├── 📂 backend/                   # FastAPI Server Layer
│   ├── 📂 app/                   # Core App Logic (MVC/Domain Architecture)
│   │   ├── 📂 api/               # API Routes & Endpoints
│   │   ├── 📂 core/              # Config, Security, Rule Engine, Websockets
│   │   ├── 📂 models/            # SQLAlchemy DB Models
│   │   ├── 📂 repositories/      # Database Access Abstraction Layer
│   │   ├── 📂 schemas/           # Pydantic Request/Response Validation
│   │   └── 📂 services/          # Business Logic & Orchestration
│   ├── 📂 alembic/               # Database Migration Scripts
│   ├── 📂 tests/                 # Unit & Integration Testing Suite
│   └── 📜 requirements.txt       # Python Dependencies
│
├── 📂 frontend/                  # React + Vite Client Layer
│   ├── 📂 src/                   # React Logic
│   │   ├── 📂 components/        # Reusable UI Blocks & Modals
│   │   ├── 📂 pages/             # Distinct Dashboard Views
│   │   └── 📂 lib/               # Utility functions & API clients
│   └── 📂 public/                # Static assets & AI Models (face-api.js)
│
└── 📜 README.md                  # You are here!
```

---

## 🤝 Contributing

We believe in writing clean, scalable, and well-documented code. If you are a developer looking to contribute:
1. Ensure you follow standard `PEP 8` guidelines for Python.
2. Use `eslint` and `oxlint` for frontend React code.
3. Keep commit messages descriptive and clear.

---

## 📄 License & Ownership

**Proprietary Software.** All rights reserved. 
Unauthorized copying, modification, distribution, or use of this software, via any medium, is strictly prohibited without explicit permission.

<div align="center">
  <sub>Built with ❤️ for a safer, smarter tomorrow.</sub>
</div>
