<div align="center">
  <h1>🛡️ AI Surveillance System</h1>
  <p><strong>Next-Generation Intelligent Video Analytics & Surveillance Platform</strong></p>
  
  [![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
  [![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
  [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
  [![YOLOv8](https://img.shields.io/badge/YOLOv8-FF1493?style=for-the-badge&logo=yolo&logoColor=white)](https://ultralytics.com/)
  [![Vite](https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E)](https://vitejs.dev/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
</div>

---

## 📖 Overview

The **AI Surveillance System** is an enterprise-grade platform designed to provide real-time, AI-driven video analytics. It seamlessly integrates a robust backend and an intuitive, dynamic frontend to offer advanced monitoring, object detection, and anomaly recognition across multiple camera streams.

### ✨ Key Features
- **Real-Time Object Detection**: Powered by YOLOv8 for highly accurate real-time inference.
- **Facial Recognition**: Integrated with `face-api.js` to process and recognize faces instantly.
- **Multi-Tenant Architecture**: Securely manage sites, cameras, and configurations across multiple organizations.
- **Interactive Dashboards**: Data-rich, aesthetic analytics dashboards using Recharts and Tailwind CSS.
- **High-Performance API**: Fully asynchronous backend built with FastAPI and PostgreSQL (SQLAlchemy).

---

## 🛠️ Technology Stack

### Backend
- **Framework**: Python 3.12+, FastAPI
- **Database**: PostgreSQL, SQLAlchemy (Async ORM), Alembic
- **AI Models**: YOLOv8 (`yolov8n.pt`)
- **Server**: Uvicorn

### Frontend
- **Framework**: React 19, Vite, TypeScript
- **Styling**: Tailwind CSS v4, Lucide React (Icons)
- **State & Data**: Axios, React Router v7
- **Analytics**: Recharts, Face-API.js

---

## 🚀 Getting Started

### Prerequisites
- Python 3.12+
- Node.js 20+
- PostgreSQL Server installed and running.

### 1. Backend Setup

```bash
# Clone the repository
git clone https://github.com/rameez-1807/SURVILENCE-SYSTEM-NEW_CODE.git
cd "AI SURVILLENCE SYSTEM/backend"

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

**Environment Configuration:**
Copy `.env.example` to `.env` and fill in your PostgreSQL credentials:
```env
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=your_password
DATABASE_NAME=ai_surveillance
```

**Database Initialization:**
```bash
# Apply database migrations
alembic upgrade head
```

### 2. Frontend Setup

```bash
cd ../frontend

# Install Node modules
npm install
```

---

## 🏃‍♂️ Running the Application

**Run the Backend:**
```bash
# From the backend directory (ensure venv is activated)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
*API Docs available at: `http://localhost:8000/docs`*

**Run the Frontend:**
```bash
# From the frontend directory
npm run dev
```
*Frontend app available at: `http://localhost:5173`*

---

## 🏗️ Architecture & Structure
```text
.
├── backend/              # FastAPI Backend application
│   ├── app/              # API routes, models, schemas
│   ├── alembic/          # Database migration scripts
│   ├── tests/            # Pytest unit & integration tests
│   └── requirements.txt  # Python dependencies
├── frontend/             # React Vite Frontend application
│   ├── src/              # React components, pages, & logic
│   └── public/           # Static assets
└── README.md             # Project documentation
```

---

## 📄 License
This project is proprietary software. All rights reserved.
