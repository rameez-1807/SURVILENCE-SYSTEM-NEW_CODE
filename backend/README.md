<div align="center">
  <br />
  <img src="https://img.icons8.com/?size=512&id=v9pIqV60v1mO&format=png" alt="Backend Logo" width="100" />
  <br />

  <h1>🧠 <strong>AI Surveillance Backend Engine</strong></h1>
  <p><strong>FastAPI-Powered Real-Time Analytics, Multi-Tenant Security & Attendance REST API Service</strong></p>

  <p>
    <a href="https://fastapi.tiangolo.com/"><img src="https://img.shields.io/badge/FastAPI-0.110+-005571?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" /></a>
    <a href="https://www.python.org/"><img src="https://img.shields.io/badge/Python-3.12+-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python 3.12" /></a>
    <a href="https://www.sqlalchemy.org/"><img src="https://img.shields.io/badge/SQLAlchemy-2.0+-D71F00?style=for-the-badge&logo=sqlalchemy&logoColor=white" alt="SQLAlchemy 2.0" /></a>
    <a href="https://alembic.sqlalchemy.org/"><img src="https://img.shields.io/badge/Alembic-Migrations-6B1724?style=for-the-badge" alt="Alembic" /></a>
    <a href="https://pydantic.dev/"><img src="https://img.shields.io/badge/Pydantic-v2-E92063?style=for-the-badge&logo=pydantic&logoColor=white" alt="Pydantic v2" /></a>
  </p>
</div>

---

## 📖 Overview

The backend service for the **AI Surveillance System** serves as the central brain handling authentication, camera stream management, face recognition & attendance records, event alerts, multi-tenant access control, and real-time WebSockets.

Built using clean **Domain-Driven Design (DDD)** principles, it isolates data structures into Repositories, Services, Schemas, and API Routers for maximal scalability.

---

## ⚡ Core Features

- 🔐 **JWT OAuth2 Authentication**: Secure access token generation, passlib password hashing, role-based authorization.
- 🪪 **Attendance & Employee Module**: Full CRUD operations for employees, automated & manual attendance logging, confidence scoring, and daily attendance aggregations.
- 🏢 **Multi-Tenant Architecture**: Complete multi-organization isolation (`Tenants` ➔ `Sites` ➔ `Cameras`).
- 🔄 **Alembic Schema Migrations**: Version-controlled database schema migrations.
- ⚡ **Rule Triggers & Event Engine**: Event notification handling for camera motion, zone breach, and recognized face alerts.

---

## 🛠️ Architecture & Module Structure

```text
backend/
├── alembic/                         # Migration scripts & env setup
│   └── versions/                    # Revision histories
├── app/                             
│   ├── api/v1/                      # Versioned API Routers
│   │   ├── auth.py                  # Authentication & Tokens
│   │   ├── attendance.py            # Attendance endpoints
│   │   ├── employees.py             # Employee management
│   │   ├── cameras.py               # Camera stream management
│   │   ├── events.py                # Security incident logs
│   │   ├── rules.py                 # Security trigger rules
│   │   ├── sites.py                 # Site location management
│   │   └── tenants.py               # Tenant organization management
│   ├── core/                        # System configurations, security, websockets
│   ├── models/                      # Async SQLAlchemy ORM Models
│   ├── repositories/                # Async Database Repositories
│   ├── schemas/                     # Pydantic Schemas (DTOs)
│   └── services/                    # Core Business Logic Layer
├── test_attendance.py               # Quick API integration test script
└── requirements.txt                 # Backend Python dependencies
```

---

## 🚀 Setup & Execution

### 1. Environment Setup
Create a `.env` file in the `backend/` root directory:

```env
APP_NAME=AI Surveillance System
APP_VERSION=0.1.0
DEBUG=true

SERVER_HOST=0.0.0.0
SERVER_PORT=8000
SECRET_KEY=your_super_secret_jwt_key
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
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

---

## 🧪 Testing

To test attendance endpoints directly:

```bash
python test_attendance.py
```

---

<div align="center">
  <sub>FastAPI Service • High Performance Video Analytics</sub>
</div>
