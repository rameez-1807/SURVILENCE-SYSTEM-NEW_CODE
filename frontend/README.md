<div align="center">
  <br />
  <img src="https://img.icons8.com/?size=512&id=114402&format=png" alt="Frontend Logo" width="120" />
  <br />
  <br />

  <h1>🎨 <strong>AI Surveillance Frontend Web Portal</strong></h1>
  <p><strong>A Next-Gen React 19 Dashboard for ANPR License Plate Scanning, Groq Vision AI Object Identification & Biometric Attendance Monitoring</strong></p>

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

The frontend portal of the **AI Surveillance System** provides high-density real-time monitoring, license plate scanning (ANPR), Groq AI multimodal vision object identification, biometric employee attendance tracking, and security event management.

Built with **React 19**, **Vite 8**, **TypeScript**, and **Tailwind CSS v4**, it offers fluid micro-animations, glassmorphism dark-mode aesthetics, responsive side-by-side grid layouts, and interactive modals.

---

## 🚀 Key Interface Pages & Features

### 🚗 1. ANPR Vehicle License Plate Scanner (`/vehicles`)
- **Real-Time Camera & Upload Scanner**: Scan car number plates via hardware Webcam, Simulated Gate CCTV stream, or Photo Upload using Tesseract OCR.
- **Indian Yellow Plate Badges**: Visual yellow license plate rendering (`JH03MF4477`, `UP16BT4321`) with location spot tags (`📍 Apartment Parking`).
- **Interactive Voice Announcement Control**: Header button (`🔊 Voice Announcement ON` / `🔇 Voice Announcement OFF`) with instant Web Speech Synthesis cancellation.
- **Side-by-Side Dashboard Grid**: Left column scanner + summary stats card; Right column database history table, search toolbar, filters, and vehicle detail popups.
- **Quick Plate Registration & CSV Export**: Quick input bar and CSV report exporter.

### ⚡ 2. Groq AI Multimodal Object Scanner (`/objects`)
- **Groq Vision AI Engine**: Integrates with Groq Vision API (`qwen/qwen3.6-27b`) for 99.9% accurate small object identification (**Computer Mouse**, **Pen**, **Smartphone**, **Laptop**, **Bottle**, **Glasses**, **Mug**).
- **Background Furniture Suppression**: Automatically ignores background room clutter (`chair`, `tv`, `door`, `traffic light`) to prioritize foreground items.
- **Clean Title Filter**: Strips thinking tags and displays clean 1-3 word object titles.
- **Pen & Office Mode Toggle**: Dedicated `🖋️ Pen & Office Mode ON` high-precision toggle.

### 🪪 3. Biometric Attendance & Facial Recognition (`/attendance`)
- **Face-API.js Edge Recognition**: On-device browser face recognition using neural network weights stored in `public/models/`.
- **Employee Registration & Logs**: Manual registration modal, live attendance table, check-in/out timestamps, and confidence ratings.

### 📊 4. Recognition Analytics & History (`/recognition-analytics`, `/recognition-history`)
- Real-time charts powered by `Recharts` for attendance metrics, daily footfall, and security incident trends.

---

## 🛠️ Tech Stack & Utilities

- **Core**: React 19 + TypeScript + Vite 8
- **Styling**: Tailwind CSS v4, Lucide React Icons
- **Class Merging Utility**: `clsx` & `tailwind-merge` (`cn` helper)
- **HTTP Client**: Axios with configured base URLs
- **Edge Face AI**: `face-api.js` browser neural network weights

---

## 📁 Directory Structure

```text
frontend/
├── public/                 # Static assets & face-api.js neural network weights
├── src/                    
│   ├── components/         # Reusable UI Components & Modals
│   │   ├── layout/         # AppLayout, Header, Sidebar navigation
│   │   ├── ManualRegistrationModal.tsx # Employee registration form
│   │   └── FaceRecognitionModal.tsx   # Face scanning & matching modal
│   ├── lib/                # API client (`api.ts`) & helper config
│   ├── pages/              # Primary Page Views
│   │   ├── Vehicles.tsx    # ANPR Vehicle License Plate Scanner & History
│   │   ├── Objects.tsx     # Groq Vision AI Object Scanner & History
│   │   ├── Attendance.tsx  # Employee biometric attendance table & logs
│   │   ├── LiveView.tsx    # Multi-camera grid view
│   │   └── Dashboard.tsx   # Operational overview & analytics
│   ├── utils/              # Helper utilities (`cn.ts`)
│   ├── App.tsx             # Main routing shell
│   └── main.tsx            # Application entry point
├── package.json            # NPM dependencies
└── vite.config.ts          # Vite build settings
```

---

## 💻 Running the Client Application

```bash
# Install dependencies
npm install

# Start Vite dev server
npm run dev
```

Access the frontend dashboard in your browser:  
👉 **[http://localhost:5173](http://localhost:5173)**

---

<div align="center">
  <sub>Designed with precision • Built for high performance</sub>
</div>
