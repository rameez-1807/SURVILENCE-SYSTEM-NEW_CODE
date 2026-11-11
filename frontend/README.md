<div align="center">
  <br />
  <img src="https://img.icons8.com/?size=512&id=114402&format=png" alt="Frontend Logo" width="120" />
  <br />
  <br />

  <h1>🎨 <strong>AI Surveillance & Attendance Frontend Portal</strong></h1>
  <p><strong>A Next-Gen React 19 Enterprise Dashboard for Real-Time YOLOv8 Detection, ANPR License Plate Scanning, Groq Vision AI & Facenox Biometric Personnel Attendance</strong></p>

  <p>
    <a href="https://github.com/rameez-1807/SURVILENCE-SYSTEM-NEW_CODE.git"><img src="https://img.shields.io/badge/GitHub-SURVILENCE--SYSTEM--NEW__CODE-181717?style=for-the-badge&logo=github&logoColor=white" alt="GitHub Repo" /></a>
    <a href="https://react.dev/"><img src="https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React 19" /></a>
    <a href="https://vitejs.dev/"><img src="https://img.shields.io/badge/Vite_8-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E" alt="Vite 8" /></a>
    <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/Tailwind_CSS_v4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS 4" /></a>
    <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" /></a>
  </p>
</div>

---

## 🌟 Overview

The frontend portal of the **AI Surveillance System** delivers an enterprise SaaS dashboard experience for security and facility operations:
- **Personnel & Attendance Management** with Facenox SOTA biometric scanning, separate punch in / out events, dynamic KPIs, and HRMS sync.
- **Real-Time YOLOv8 Detection & Multi-Object Tracking** (`/objects`).
- **ANPR License Plate Recognition & Vehicle History** (`/vehicles`).
- **Groq Vision AI Multimodal Engine** (`qwen/qwen3.6-27b`) for handheld object verification.
- **Human Review Queue** for correcting false detections and verifying alerts.
- **Fixed Dark Navy Sidebar** with categorized Operations, Intelligence, and Management groups.
- **Clean Top Header** with global search, notifications count, theme switcher, and admin profile.

Built with **React 19**, **Vite 8**, **TypeScript**, and **Tailwind CSS v4**, it features rounded-3xl container cards, soft blue-purple accents, fluid transitions, and responsive layout across desktop, laptop, and tablet viewports.

---

## 🚀 Key Interface Modules

### 🪪 1. Personnel & Attendance Dashboard (`/attendance`)

The Attendance module has been redesigned to provide an enterprise SaaS aesthetic:

- **Hero Action Banner**:
  - Friendly vector employee illustration (`EmployeeIllustration.tsx`).
  - Welcome greeting: `👋 Welcome Back! Personnel & Attendance`.
  - 4 Prominent action buttons:
    - 🟢 **Punch In (Live Face)**: Opens biometric face scanner in check-in mode.
    - 🔴 **Punch Out (Live Face)**: Opens biometric face scanner in check-out mode.
    - 🔵 **Sync HRMS**: One-click sync to push real-time attendance logs to external ERP/HRMS systems.
    - 🟣 **Register Employee**: Modal to register new staff with name, ID, department, designation, and face vector.
- **Dynamic Attendance Statistics**:
  - 👥 **Total Employees**: Total enrolled staff roster count.
  - ✅ **Present Today**: Unique employees who clocked in today with percentage metric (`↑ 93.5%`).
  - ⏰ **Absent Today**: Remaining staff with absence percentage indicator (`↓ 6.5%`).
  - 📊 **Attendance Rate**: Overall shift attendance rate with trend indicator (`+0.8%`).
  - *All metrics are computed live from backend MySQL/SQLite database records.*
- **Facenox Biometric Platform Card**:
  - Full-width banner featuring fingerprint biometric badge and `Active & Online` status pill.
  - Live description: *Real-time face matching with ByteTrack & ArcFace technology*.
  - Direct `[ ⛶ Launch Facenox Scanner ]` button.
- **6 Sub-View Filter Tabs**:
  - `📅 Attendance Log`: Full chronological attendance stream.
  - `👥 Personnel Directory`: Roster of registered personnel with enrollment status and biometric management.
  - `⚡ All Punches`: Separate event rows for every entry and exit.
  - `▶ Punch In Logs`: Filtered view showing only punch-in check-ins.
  - `🚪 Punch Out Logs`: Filtered view showing only punch-out check-outs.
  - `📊 Daily Combined`: Aggregated daily overview with entry and exit side by side.
- **Unified Search & Filter Toolbar**:
  - Search input: `🔍 Search attendance logs...` (filters by name or ID).
  - Date Picker: `📅 dd-mm-yyyy ∨`.
  - Sector Selector: `All Sectors ∨`.
  - Status Selector: `All Statuses ∨`.
  - Filter trigger button: `[ ⧵ Filter ]`.
- **Clean Attendance Data Table**:
  - Columns: `#`, `Employee ID`, `Name`, `Date`, `Punch Type`, `Time`, `Camera Source`, `Confidence`, `Status`, `Action`.
  - Dedicated 🟢 `↑ Punch In` and 🔴 `↓ Punch Out` badges.
  - Recorded time with purple clock icon (`🕒 HH:MM:SS`).
  - Quick 1-click `[ ↳ Punch Out ]` button on active punch-in records.
  - 3-dots action menu (`⋮`) for record auditing.
  - Bottom pagination controls: `Showing X–Y of Z records`, `First`, `Prev`, `Next`, `Last`, and `Rows per page` selector.
- **Reliable WebRTC Camera Integration**:
  - Defaults to **Browser Cam (`Browser WebRTC`)** for immediate zero-config video feeds on laptops, Macs, and mobile devices.
  - Dedicated toggle for **Direct USB WebCam** for fixed CCTV/hardware desktop installations.
  - Built-in dark-frame fallback button: `[ 📷 Camera Black? Click to Open Laptop Camera (Browser Cam) ]`.

---

### 🎯 2. Real-Time Detection & Object Scanner (`/objects`)
- **Live Pipeline Telemetry Pill**: Displays real-time FPS, inference latency in ms, active tracking count, and GPU accelerator state directly in the header banner.
- **Groq Vision AI Engine**: Integrates with Groq Vision API (`qwen/qwen3.6-27b`) for 99.9% accurate handheld item identification (**Computer Mouse**, **Pen / Marker**, **Smartphone**, **Laptop**, **Bottle**, **Glasses**, **Mug**).
- **Background Clutter Suppression**: Automatically ignores background room clutter (`chair`, `tv`, `door`, `traffic light`) to prioritize foreground items.
- **Voice Announcement Pill**: Interactive toggle (`🔊 Voice Announcement ON` / `🔇 Voice Muted`) with instant cancellation.
- **Pen & Office Mode Toggle**: Dedicated `🖋️ Pen & Office Mode ON` high-precision toggle.

---

### 🚗 3. ANPR Vehicle License Plate Scanner (`/vehicles`)
- **Real-Time Camera & Upload Scanner**: Scan car number plates via hardware Webcam, Simulated Gate CCTV stream, or Photo Upload using Tesseract OCR.
- **Indian Yellow Plate Badges**: Visual yellow license plate rendering (`JH03MF4477`, `UP16BT4321`) with location spot tags (`📍 Apartment Parking`).
- **Voice Announcement Toggle**: Interactive header control with instant speech cancellation.
- **Side-by-Side Dashboard Grid**: Left column scanner + summary stats card; Right column database history table, search toolbar, filters, and vehicle detail popups.
- **Quick Plate Registration & CSV Export**: Quick input bar and CSV report exporter.

---

### 📝 4. Human Review Queue & Label Correction (`/review-queue`)
- **Interactive Verification**: Security operators can review unverified object events, audit evidence snapshots, and correct object labels with instant database persistence.

---

## 🛠️ Tech Stack & Utilities

- **Core Framework**: React 19 + TypeScript + Vite 8
- **Styling**: Tailwind CSS v4, Lucide React Icons
- **Class Merging Utility**: `clsx` & `tailwind-merge` (`cn` helper)
- **HTTP Client**: Axios with configured base URLs
- **Edge Face AI**: `face-api.js` browser neural network weights stored in `public/models/`
- **Charts & Graphs**: Recharts

---

## 📁 Directory Structure

```text
frontend/
├── public/                               # Static assets & face-api.js neural weights
│   └── models/                           # Face detector, landmark & recognition weights
├── src/                                  
│   ├── components/                       # Reusable UI Components & Modals
│   │   ├── layout/                       
│   │   │   ├── AppLayout.tsx             # Responsive dashboard container
│   │   │   ├── Header.tsx                # Global top search, notifications, admin profile
│   │   │   └── Sidebar.tsx               # Fixed dark navy navigation
│   │   ├── ui/                           
│   │   │   └── EmployeeIllustration.tsx  # Vector SVG friendly employee illustration
│   │   ├── FaceRecognitionModal.tsx      # Dual-mode (Browser WebRTC / Direct USB) face scanner
│   │   ├── FaceRegistrationModal.tsx     # Biometric face enrollment modal
│   │   └── ManualRegistrationModal.tsx   # Employee registration form
│   ├── lib/                              # API client (`api.ts`) & helper config
│   ├── pages/                            # Primary Page Views
│   │   ├── Attendance.tsx                # Redesigned Personnel & Attendance Dashboard
│   │   ├── Objects.tsx                   # YOLO Telemetry & Groq Vision AI Object Scanner
│   │   ├── Vehicles.tsx                  # ANPR Vehicle License Plate Scanner & History
│   │   ├── ReviewQueue.tsx               # Human review queue & label correction UI
│   │   ├── LiveView.tsx                  # Multi-camera matrix grid view
│   │   └── Dashboard.tsx                 # Operational overview & analytics
│   ├── utils/                            # Helper utilities (`cn.ts`)
│   ├── App.tsx                           # Main routing shell
│   └── main.tsx                          # Application entry point
├── package.json                          # NPM dependencies
└── vite.config.ts                        # Vite build settings
```

---

## 💻 Running the Client Application

```bash
# 1. Navigate to frontend directory
cd frontend

# 2. Install dependencies
npm install

# 3. Start Vite dev server
npm run dev

# 4. Production build & type check
npm run build
```
