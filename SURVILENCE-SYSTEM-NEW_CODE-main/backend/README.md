<div align="center">
  <br />
  <img src="https://img.icons8.com/?size=512&id=v9pIqV60v1mO&format=png" alt="Backend Logo" width="100" />
  <br />

  <h1>🧠 <strong>AI Surveillance Backend Service</strong></h1>
  <p><strong>FastAPI-Powered Real-Time Video Analytics, ANPR Vehicle Engine, Groq AI Multimodal Vision & Biometric Attendance REST API</strong></p>

  <p>
    <a href="https://fastapi.tiangolo.com/"><img src="https://img.shields.io/badge/FastAPI-0.110+-005571?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" /></a>
    <a href="https://groq.com/"><img src="https://img.shields.io/badge/Groq_Vision_AI-f55036?style=for-the-badge&logo=groq&logoColor=white" alt="Groq Vision AI" /></a>
    <a href="https://www.python.org/"><img src="https://img.shields.io/badge/Python-3.12+-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python 3.12" /></a>
    <a href="https://www.sqlalchemy.org/"><img src="https://img.shields.io/badge/SQLAlchemy-2.0+-D71F00?style=for-the-badge&logo=sqlalchemy&logoColor=white" alt="SQLAlchemy 2.0" /></a>
    <a href="https://alembic.sqlalchemy.org/"><img src="https://img.shields.io/badge/Alembic-Migrations-6B1724?style=for-the-badge" alt="Alembic" /></a>
  </p>
</div>

---

## 📖 Overview

The backend service for the **AI Surveillance System** serves as the core intelligence engine. It handles:
- **Automatic License Plate Recognition (ANPR)** and vehicle history persistence (`/api/v1/vehicles`).
- **Groq Multimodal AI Vision** object scanning (`/api/v1/events/vision-scan`).
- **Biometric Employee Profile Management** & face attendance tracking (`/api/v1/attendance`, `/api/v1/employees`).
- **Multi-Tenant Data Isolation** & security incident rules (`/api/v1/tenants`, `/api/v1/sites`, `/api/v1/cameras`).

Built using **Domain-Driven Design (DDD)** principles, it separates Repositories, Services, Schemas (Pydantic DTOs), and API Routers for maximal performance and scalability.

---

## ⚡ Core Modules & Features

- 🚗 **ANPR License Plate Engine (`app/services/vehicle.py`)**:
  - OpenCV contour bounding rect detection and Tesseract OCR text extraction.
  - Formats Indian license plate numbers (e.g. `JH03MF4477`, `UP16BT4321`) and tags location spots (`📍 Apartment Parking`).
  - Async SQLite database storage and bulk history clear route (`DELETE /api/v1/vehicles`).

- ⚡ **Groq Multimodal AI Vision Engine (`app/api/v1/events.py`)**:
  - Integrates Groq API (`GROQ_API_KEY`) using model `qwen/qwen3.6-27b`.
  - Performs fast ~0.2s object detection for small handheld items (**Computer Mouse**, **Pen / Marker**, **Smartphone**, **Laptop**, **Bottle**, **Glasses**).
  - Built-in Regex sanitizer (`re.sub(r'<think>.*?</think>', '', ...)`) strips internal LLM thinking tags to return clean 1-3 word object names.

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
│   │   ├── vehicles.py              # ANPR Vehicles API (scan, list, delete)
│   │   ├── events.py                # Security Events & Groq Vision API
│   │   ├── auth.py                  # OAuth2 JWT Tokens
│   │   ├── attendance.py            # Biometric Attendance endpoints
│   │   ├── employees.py             # Employee profile management
│   │   ├── cameras.py               # Camera stream management
│   │   ├── rules.py                 # Security trigger rules
│   │   ├── sites.py                 # Site location management
│   │   └── tenants.py               # Tenant organization management
│   ├── core/                        # Settings, Groq API config, Security
│   ├── models/                      # Async SQLAlchemy ORM Models (VehicleRecord, Event, etc.)
│   ├── repositories/                # Async Database Repositories
│   ├── schemas/                     # Pydantic Schemas (DTOs)
│   └── services/                    # ANPR & Vehicle Business Logic Layer
├── .env                             # Environment File (GROQ_API_KEY)
├── ai_surveillance.db               # SQLite Database Instance
└── requirements.txt                 # Backend Python dependencies
```

---

## 🚀 Setup & Execution

### 1. Environment Setup
Create or update `.env` in the `backend/` root directory:

```env
APP_NAME=AI Surveillance System
APP_VERSION=0.1.0
DEBUG=true

SERVER_HOST=0.0.0.0
SERVER_PORT=8000

# Groq AI Vision Key
GROQ_API_KEY=your_groq_api_key_here
```

### 2. Install Dependencies
```bash
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Run Database Migrations
```bash
alembic upgrade head
```

### 4. Start Server
```bash
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

---

## 📡 API Reference Summary

- `GET /api/v1/vehicles`: List vehicle records with search and filters.
- `POST /api/v1/vehicles/scan`: Scan number plate & save to SQLite DB.
- `DELETE /api/v1/vehicles`: Clear all vehicle records.
- `POST /api/v1/events/vision-scan`: Run Groq AI Vision object detection.
- `DELETE /api/v1/events/clear-all`: Clear all object detection events.

🔥 *Interactive Swagger UI available at: `http://localhost:8000/docs`*

---

<div align="center">
  <sub>FastAPI Service • High-Performance AI Video Analytics Engine</sub>
</div>
