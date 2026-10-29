<div align="center">

  <br />

  <img src="https://img.icons8.com/?size=512&id=v9pIqV60v1mO&format=png" alt="AI Surveillance Logo" width="110" />

  <br />
  <br />

  <h1>🛡️ <strong>MULTI CAMERA AI SURVEILLANCE & REAL TIME ANALYTICS PLATFORM</strong></h1>

  <p>
    <strong>Enterprise Real-Time Video Analytics • RF-DETR Nano Vision Transformer • YOLOv9 / YOLO-World / YOLOE Detection • ByteTrack Multi-Object Tracking • Quad-Engine Hybrid ANPR Plate Scanner • Groq Vision AI • CI/CD Auto-Deploy to AWS EC2 • Full Light & Dark Theme</strong>
  </p>

  <p>
    <a href="https://github.com/rameez-1807/SURVILENCE-SYSTEM-NEW_CODE.git"><img src="https://img.shields.io/badge/GitHub-Repository-181717?style=for-the-badge&logo=github&logoColor=white" alt="GitHub Repo" /></a>
    <a href="https://github.com/rameez-1807/SURVILENCE-SYSTEM-NEW_CODE/actions"><img src="https://img.shields.io/badge/CI%2FCD-AWS_EC2_Pipeline-232F3E?style=for-the-badge&logo=githubactions&logoColor=white" alt="CI/CD EC2" /></a>
    <a href="https://fastapi.tiangolo.com/"><img src="https://img.shields.io/badge/FastAPI-0.115+-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" /></a>
    <a href="https://react.dev/"><img src="https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React 19" /></a>
    <a href="https://vitejs.dev/"><img src="https://img.shields.io/badge/Vite_8-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite 8" /></a>
    <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/Tailwind_CSS_v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS v4" /></a>
    <a href="https://github.com/roboflow/rf-detr"><img src="https://img.shields.io/badge/RF--DETR_Nano-Vision_Transformer-7C3AED?style=for-the-badge&logo=pytorch&logoColor=white" alt="RF-DETR Nano" /></a>
    <a href="https://groq.com/"><img src="https://img.shields.io/badge/Groq_Vision_AI-F55036?style=for-the-badge&logo=groq&logoColor=white" alt="Groq Vision AI" /></a>
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
    <a href="#-step-by-step-installation--setup-guide-pc--laptop">Installation Guide</a> •
    <a href="#-deployment-guide">Deployment</a>
  </p>

</div>

---

## 📖 System Overview

The **AI Surveillance System** is an enterprise-grade, high-performance security intelligence platform built to monitor, detect, track, and alert across multiple camera streams in real time. 

Engineered with an asynchronous Python backend (**FastAPI + SQLAlchemy 2.0 Async + WebSockets**) and a reactive glassmorphic frontend (**React 19 + TypeScript + Tailwind CSS v4**), the platform seamlessly orchestrates:

* 🎯 **YOLO-World Open-Vocabulary Detection**: Zero-shot real-time open-vocabulary neural inference with text embeddings (e.g. mobile phones, watches, pens, laptops, tablets, or custom classes added on the fly).
* 🛰️ **Deterministic ByteTrack Multi-Object Tracking**: Persistent identity tracking (`track_id`) across consecutive video frames with debounced cooldowns to eliminate database duplicates.
* 🛡️ **Interactive ROI Security Zones**: Polygon ray-casting algorithm to detect perimeter breaches and loitering.
* 🚗 **ANPR License Plate Scanner**: Real-time vehicle license plate extraction with OpenCV contour analysis and EasyOCR.
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

### 1. 🎯 Real-Time Multi-Model Object Detection & Tracking (`/objects`)
- **Premier Model: RF-DETR Nano (Vision Transformer)**: DINOv2 vision transformer backbone with ByteTrack tracking, supporting 80 COCO classes with sub-second CPU latency (~440ms) and GPU acceleration.
- **Multiple AI Detection Engines**: Choose effortlessly from dedicated cards in the UI:
  - 🟣 **RF-DETR Nano (Transformer)**: Premier vision transformer with deep visual features and ByteTrack tracking.
  - 🌐 **Browser Detection (Free / Zero-Lag)**: Client-side TensorFlow COCO-SSD running directly in your browser without server bandwidth.
  - 🤖 **YOLOE Auto Detect (Prompt-Free)**: Zero-shot prompt-free everyday object and human detection.
  - ⚡ **YOLOv9-C (Official + ByteTrack)**: PGI architecture with multi-target tracking.
  - 🔍 **YOLO-World (Open-Vocab)**: Dynamic vocabulary detection with custom prompt inputs.
  - ⚖️ **YOLO11m (Standard COCO)**: Balanced standard object detector.
- **Hardware Agnostic**: Automatic GPU detection (`CUDA`) with seamless CPU zero-copy fallback (`torch.no_grad()`).
- **Front & Back Camera Toggle**: Dual camera selector allowing seamless surveillance on laptops, webcams, smartphones, and tablets.
- **Temporal Stability & Debouncing**: ByteTrack multi-object tracking guarantees persistent IDs (`track_id`) across occlusions with cooldown debouncers to eliminate duplicate database events.

### 2. 🚗 Quad-Engine Indian ANPR License Plate Scanner (`/vehicles`)
- **Quad-Engine Modular Architecture**: Select in real-time between four high-performance recognition engines:
  - 🛡️ **YOLO + EasyOCR (Default Engine)**: Original production baseline using YOLO plate detector with EasyOCR contour recognition.
  - ⚡ **Hybrid ANPR (Awiros Micro-Worker + Fallback)**: High-precision OCR micro-worker architecture (`awiros_worker`), dual-line plate re-stacking for Indian motorcycles & commercial vehicles, Indian RTO regex heuristics, and automatic seamless fallback to EasyOCR.
  - ⚡ **FastALPR (ONNX Runtime)**: Ultra high-speed (~100 ms) YOLOv9-T detector + CCT Transformer OCR optimized for high-FPS live video feeds.
  - 🇮🇳 **Indian ANPR Engine**: Dedicated YOLO plate detector (`references/indian-anpr/best.pt`) with multi-pass deskew OCR, two-line motorcycle & HSRP analysis, and Indian RTO state validation.
- **Side-by-Side Accuracy Benchmark**: Integrated benchmarking suite running on identical labelled Indian vehicle plates across 12 Indian states (cars & motorcycles). View full-plate exact accuracy and latency metrics directly in the UI.
- **Duplicate Prevention & Best Snapshot**: Automatically prevents database spam within a 20-second session window while automatically upgrading saved records if a higher-confidence frame is captured.
- **Voice Announcements**: Built-in speech synthesis toggle (`🔊 Voice Announcement ON / OFF`) announcing detected license plates.
- **Historical Records & Evidence**: Full SQLite & MongoDB sync with location-sorted evidence image archives and CSV export.

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

## 💻 Step-by-Step Installation & Setup Guide (PC / Laptop)

Follow these clear, step-by-step instructions to set up, install dependencies, and run the **Multi Camera AI Surveillance & Real Time Analytics Platform** on any Windows PC, Linux machine, or macOS.

---

### 1️⃣ System Prerequisites

Before starting, ensure the following software is installed on your computer:

| Software | Required Version | Download Link | Verification Command |
|:---|:---|:---|:---|
| **Python** | `3.10` to `3.12+` | [python.org/downloads](https://www.python.org/downloads/) | `python --version` |
| **Node.js** & **npm** | `Node 18+` / `npm 9+` | [nodejs.org](https://nodejs.org/) | `node -v` and `npm -v` |
| **Git** | Any modern version | [git-scm.com](https://git-scm.com/) | `git --version` |
| **Webcam / Camera** | Built-in or USB | Laptop Webcam or USB Cam | Device Manager / Camera App |

> [!IMPORTANT]
> **Windows Users**: When installing Python, make sure to check the box: **"Add python.exe to PATH"**!

---

### 2️⃣ Step 1: Clone the Repository

Open your terminal (**PowerShell**, **Command Prompt**, or **Bash**) and clone the project:

```bash
# Clone the repository
git clone https://github.com/rameez-1807/SURVILENCE-SYSTEM-NEW_CODE.git
# (Alternative Mirror: https://github.com/NighwanTech/AI_SURVILENCE-SYSTEM.git)

# Navigate into the project directory
cd SURVILENCE-SYSTEM-NEW_CODE
```

---

### 3️⃣ Step 2: Backend Setup & Installation

The backend is built with FastAPI, PyTorch, OpenCV, and WebSockets.

#### 1. Open Terminal 1 for Backend:
```bash
# Navigate to the backend directory
cd backend
```

#### 2. Create and Activate Python Virtual Environment:

- **Windows (PowerShell)**:
  ```powershell
  # If PowerShell shows script execution policy error, run this once:
  Set-ExecutionPolicy -Scope CurrentUser RemoteSigned

  # Create virtual environment
  python -m venv venv

  # Activate virtual environment
  .\venv\Scripts\Activate.ps1
  ```

- **Windows (Command Prompt / CMD)**:
  ```cmd
  python -m venv venv
  venv\Scripts\activate.bat
  ```

- **Linux / macOS**:
  ```bash
  python3 -m venv venv
  source venv/bin/activate
  ```

*(Once activated, your terminal prompt will show `(venv)` at the beginning).*

#### 3. Install Python Dependencies:
```bash
# Upgrade pip to latest version
python -m pip install --upgrade pip

# Install all backend requirements
pip install -r requirements.txt
```

#### 4. Seed Database (Admin & Initial Config):
```bash
# Seed SQLite database with default admin credentials
python seed_sqlite.py
```

#### 5. Start the FastAPI Backend Server:
```bash
# Start server with auto-reload enabled
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

✅ **Backend is running!** You should see:
```text
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Application startup complete.
```

---

### 4️⃣ Step 3: Frontend Setup & Installation

The frontend is a modern React 19 + TypeScript + Vite web application.

#### 1. Open a New / Separate Terminal (Terminal 2):
```bash
# Navigate to the frontend directory
cd frontend
```

#### 2. Install Node.js Dependencies:
```bash
npm install
```

#### 3. Start the Frontend Development Server:
```bash
npm run dev
```

✅ **Frontend is running!** You will see:
```text
  VITE v8.3.0  ready in 450 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

---

### 5️⃣ Step 4: Open & Use the System in Your Browser

Open Google Chrome, Microsoft Edge, or Firefox and go to:
👉 **[http://localhost:5173](http://localhost:5173)**

#### 🔑 Default Login Credentials:
- **Email**: `admin@example.com`
- **Password**: `admin123`
*(Or click direct demo sign-in)*

---

### 🎯 Key Pages & How to Test on Your PC:

| Page | URL | How to Test |
|:---|:---|:---|
| **Object Detection** | `http://localhost:5173/objects` | 1. Click **"Start Live Camera"** on the left.<br />2. Allow camera permission in browser.<br />3. Point your laptop camera at any object (*laptop, mobile phone, bottle, cup, chair, person*).<br />4. View live bounding boxes on the **left**, and real-time detected names & history table on the **right**! |
| **Vehicle & ANPR** | `http://localhost:5173/vehicles` | Test continuous ANPR number plate detection via live webcam or simulated gate CCTV. |
| **Light & Dark Mode** | Any Page | Click the **Sun (☀️) / Moon (🌙)** icon in the top header to toggle between sleek Dark Mode and crisp Light Mode (including side menu). |
| **Swagger API Docs** | `http://127.0.0.1:8000/docs` | Interactive API documentation for all REST endpoints and WebSockets. |

---

### 🛠️ Common Troubleshooting Tips for PC:

- **Error: "File Activate.ps1 cannot be loaded because running scripts is disabled"**:
  Run PowerShell as Administrator or run:
  ```powershell
  Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
  ```
- **Port 8000 or 5173 Already in Use**:
  Check running processes and kill stale processes:
  ```powershell
  # Windows PowerShell:
  Get-Process -Id (Get-NetTCPConnection -LocalPort 8000).OwningProcess | Stop-Process -Force
  ```
- **Webcam Access Blocked**:
  In Chrome/Edge URL bar, click the camera icon next to `http://localhost:5173` and set Camera permissions to **"Allow"**.

## 🚀 Deployment Guide

### ☁️ Production Deployment on AWS EC2 (Recommended)

The project includes production-ready automated bash scripts inside the `deploy/` directory to configure an **Amazon Linux 2023** instance with Python 3.11, Node.js 20, 4 GB Swap space, Nginx Reverse Proxy, HTTPS / SSL, SystemD background daemon, and MongoDB Atlas cloud synchronization.

#### 1. EC2 Instance Launch Recommendations
* **AMI**: Amazon Linux 2023 AMI (64-bit x86)
* **Instance Type**: `m7i-flex.large` (2 vCPU, 8 GiB RAM) or `t3.medium` (2 vCPU, 4 GiB RAM)
* **Storage**: At least **30 GiB** (gp3)
* **Security Group Inbound Rules**:
  * SSH: Port `22` (Source: Anywhere / My IP)
  * HTTP: Port `80` (Source: `0.0.0.0/0`)
  * HTTPS: Port `443` (Source: `0.0.0.0/0`)

#### 2. Quick 1-Click Deployment Commands
Connect to your EC2 instance via **EC2 Instance Connect** or SSH and execute:

```bash
# 1. Install Git and clone repository
sudo yum install -y git
git clone https://github.com/rameez-1807/SURVILENCE-SYSTEM-NEW_CODE.git
cd SURVILENCE-SYSTEM-NEW_CODE

# 2. Automated System Setup (Python 3.11, Node 20, Nginx, 4GB Swap, OpenCV GL)
bash deploy/ec2-setup.sh

# 3. Deploy Application (Builds React frontend, installs Python CPU PyTorch, configures Nginx & SystemD)
bash deploy/ec2-deploy.sh

# 4. Initialize Database Tables and Admin User
bash deploy/fix-db.sh

# 5. Connect MongoDB Atlas Cloud Database
bash deploy/set-mongo.sh

# 6. Enable HTTPS / SSL (Crucial for browser webcam / WebRTC camera permissions)
bash deploy/enable-https.sh
```

#### 3. Default Credentials
* **Web UI URL**: `https://<YOUR_EC2_PUBLIC_IP>` or `http://<YOUR_EC2_PUBLIC_IP>`
* **Admin Email**: `admin@example.com`
* **Admin Password**: `admin123`
* **API Documentation**: `https://<YOUR_EC2_PUBLIC_IP>/docs`

#### 4. Service Maintenance & Management
```bash
# View live backend logs
sudo journalctl -u surveillance-backend -f

# Restart backend service
sudo systemctl restart surveillance-backend

# Check backend status
sudo systemctl status surveillance-backend --no-pager

# Pull latest code from GitHub and redeploy in 1 step
bash deploy/ec2-update.sh
```

#### 5. Browser Camera (WebRTC) Permissions
* **With HTTPS**: Simply open `https://<YOUR_EC2_PUBLIC_IP>/objects`, accept the self-signed certificate (Advanced → Proceed), and click **Allow** when prompted for camera access.
* **With HTTP**: If using `http://`, enable Chrome flag:
  1. Navigate to `chrome://flags/#unsafely-treat-insecure-origin-as-secure`
  2. Add `http://<YOUR_EC2_PUBLIC_IP>`
  3. Select **Enabled** and click **Relaunch**.

---

### 🔄 Automated CI/CD Pipeline to AWS EC2 (GitHub Actions)

This repository includes a production-grade automated CI/CD pipeline configured at `.github/workflows/deploy.yml`. Every code push to `main` (or `master`) automatically triggers test verification, frontend build validation, and zero-downtime deployment over SSH directly to your AWS EC2 instance.

```mermaid
flowchart LR
    Dev["Developer Push (git push)"] --> GH["GitHub Repository (main branch)"]
    subgraph GitHub_Actions["GitHub Actions Runner"]
        GH --> Lint["Python Syntax & Flake8 Checks"]
        Lint --> Build["Node.js 20 & Vite Frontend Build"]
    end
    subgraph AWS_EC2["AWS EC2 Production Server"]
        Build --> SSH["SSH Remote Deploy (appleboy/ssh-action)"]
        SSH --> Pull["git pull latest code"]
        Pull --> Deps["Update Pip & NPM Packages"]
        Deps --> Rebuild["npm run build"]
        Rebuild --> Restart["systemctl restart surveillance-backend & awiros-worker"]
        Restart --> Nginx["systemctl reload nginx"]
        Nginx --> Health["HTTP 200 Health Verification"]
    end
```

#### Setting Up GitHub Secrets for Auto-Deployment

To connect your GitHub repository with your EC2 server, configure the following secrets in GitHub:
1. Navigate to your GitHub Repository: **Settings** → **Secrets and variables** → **Actions**.
2. Click **New repository secret** and add the following secrets:

| Secret Name | Value Description | Example |
| :--- | :--- | :--- |
| `EC2_HOST` | The Public IPv4 address or Public DNS of your AWS EC2 instance. | `3.109.123.45` or `ec2-3-109-123-45.compute-1.amazonaws.com` |
| `EC2_USERNAME` | The SSH default user for your EC2 instance. | `ec2-user` (Amazon Linux 2023) or `ubuntu` |
| `EC2_SSH_KEY` | The entire private key file (`.pem`) used to connect to your EC2 instance. Include `-----BEGIN RSA PRIVATE KEY-----` and `-----END RSA PRIVATE KEY-----`. | `-----BEGIN OPENSSH PRIVATE KEY----- ...` |
| `EC2_PORT` *(Optional)* | SSH port (defaults to 22 if omitted). | `22` |

#### How It Works:
* **Automatic on Push**: Every time you run `git push origin main` or `git push personal main`, GitHub Actions tests your backend, compiles the frontend bundle, connects to your EC2 server over SSH, executes `deploy/ec2-update.sh`, and validates the `/health` endpoint.
* **Manual Trigger**: You can also trigger a deployment anytime from the **Actions** tab in GitHub by selecting **CI/CD Pipeline & EC2 Auto-Deploy** and clicking **Run workflow**.

---

---

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
2. Import your GitHub repository: `AI_SURVILENCE-SYSTEM`.
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

## 🔒 Security & Privacy (Audited & Hardened)

* **Cryptographic Authentication**: JWT access tokens validated with strict algorithms and expiry. Insecure demo bypass tokens are completely rejected in production.
* **MongoDB Multi-Tenant Scoping**: All MongoDB Atlas collections (`events`, `vehicles`, `employees`, `attendance_records`) enforce strict `tenant_id` scoping and compound indexes for complete tenant data isolation.
* **NoSQL Injection Defense**: Dynamic queries are sanitized with recursive key and operator stripping (`$where`, `$gt`, `$ne`, etc.).
* **Zero Committed Secrets**: `.env` and sensitive credentials are encrypted / strictly excluded via `.gitignore`.
* **Hardened CORS Policy**: Strict origin whitelist for trusted local and cloud instances (EC2 HTTPS reverse proxy) with disabled credentials on wildcards.
* **Path Traversal Protection**: Evidence media endpoints utilize `Path.resolve()` and `is_relative_to()` boundary validation.
* **Dual Camera Switching**: WebRTC camera support with front/back camera facing toggles for smartphone & tablet mobile surveillance.

---

<div align="center">
  <sub>Crafted with ❤️ for Next-Generation Security Intelligence • AI Surveillance System</sub>
</div>
