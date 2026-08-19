<div align="center">
  <br />
  <img src="https://img.icons8.com/?size=512&id=114402&format=png" alt="Frontend Logo" width="120" />
  <br />
  <br />

  <h1>🎨 <strong>AI Surveillance Frontend Interface</strong></h1>
  <p><strong>A Next-Gen, High-Performance Dashboard for Real-Time Security & Biometric Attendance Monitoring</strong></p>

  <p>
    <a href="https://react.dev/"><img src="https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React 19" /></a>
    <a href="https://vitejs.dev/"><img src="https://img.shields.io/badge/Vite_8-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E" alt="Vite 8" /></a>
    <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/Tailwind_CSS_v4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS 4" /></a>
    <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" /></a>
    <a href="https://recharts.org/"><img src="https://img.shields.io/badge/Recharts-3.0+-22B5BF?style=for-the-badge" alt="Recharts" /></a>
  </p>
</div>

---

## 🌟 Overview

The frontend interface of the **AI Surveillance System** is designed for high-density information display, real-time video stream viewing, biometric employee registration, facial recognition, and event management.

Built with **React 19** and **Tailwind CSS v4**, it provides fluid transitions, sleek glassmorphism themes, responsive charts, and modal-driven workflows.

---

## 🚀 Key Interface Modules

### 📊 Dashboard & Analytics
- Overview stats for active cameras, total detected events, and attendance summary.
- Real-time incident charts powered by `Recharts`.

### 🪪 Biometric Attendance Management
- Live attendance logging table with check-in & check-out timestamps.
- **Manual Registration Modal**: Register new employees with department, designation, and ID credentials.
- **Face Recognition Modal**: Interactive edge face recognition using `face-api.js` weights stored in `public/models/`.

### 🎥 Multi-Camera Grid & Live View
- View real-time RTSP/WebRTC streams side-by-side with stream profile toggles and camera site tagging.

### 🛡️ Security Incidents & Rule Engine
- Event hub showing evidence snapshots, detection bounding boxes, and severity filters.

---

## 🛠️ Tech Stack & Utilities

- **Core**: React 19 + TypeScript + Vite 8
- **Styling**: Tailwind CSS v4, Lucide React Icons
- **Utility Functions**: `clsx` & `tailwind-merge` (`cn` helper) for dynamic class merging
- **HTTP Client**: Axios with configured base URLs and Authorization headers
- **Edge AI**: `face-api.js` model weights offloaded in client browser

---

## 📁 Directory Structure

```text
frontend/
├── public/                 # Static assets & face-api.js neural net weights
├── src/                    
│   ├── components/         # Reusable UI Blocks
│   │   ├── layout/         # AppLayout, Header, Sidebar navigation
│   │   ├── ManualRegistrationModal.tsx # Employee registration form
│   │   └── FaceRecognitionModal.tsx   # Face scanning & matching modal
│   ├── lib/                # API client (`api.ts`) & configuration
│   ├── pages/              # Primary Route Components
│   │   ├── Dashboard.tsx   # Operational overview & analytics
│   │   ├── Attendance.tsx  # Employee attendance table & logs
│   │   ├── LiveView.tsx    # Multi-camera grid view
│   │   ├── Objects.tsx     # AI Detection log page
│   │   └── Events.tsx      # Security alert events
│   ├── utils/              # Helper utilities (`cn.ts`)
│   ├── App.tsx             # Main routing shell
│   └── main.tsx            # Application entry point
├── package.json            # NPM scripts & dependencies
└── vite.config.ts          # Vite build settings
```

---

## 💻 Running the App

```bash
# Install dependencies
npm install

# Start Vite hot-reloading dev server
npx vite --host 0.0.0.0
```

Access the application in your browser:
👉 **[http://localhost:5173](http://localhost:5173)**

---

<div align="center">
  <sub>Designed with precision • Built for performance</sub>
</div>
