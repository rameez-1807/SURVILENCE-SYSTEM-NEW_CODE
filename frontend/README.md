<div align="center">
  <br />
  <img src="https://img.icons8.com/?size=512&id=114402&format=png" alt="Frontend Logo" width="100" />
  <br />

  <h1>🎨 <strong>AI Surveillance - Frontend Interface</strong></h1>
  <p><strong>A stunning, high-performance, real-time dashboard for intelligent monitoring.</strong></p>

  <p>
    <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React 19" /></a>
    <a href="https://vitejs.dev/"><img src="https://img.shields.io/badge/Vite-v8-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E" alt="Vite" /></a>
    <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS 4" /></a>
    <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" /></a>
  </p>
</div>

---

## 🌟 Overview

The frontend interface of the **AI Surveillance System** is meticulously crafted for extreme performance, real-time interactivity, and a premium aesthetic feel. 

Using bleeding-edge web technologies, it seamlessly consumes the FastAPI backend to visualize high-resolution streams, rich analytics, real-time security events, and complex multi-tenant administration workflows—all wrapped in a highly polished, glassmorphic UI.

---

## 🚀 Technical Highlights

- **Lightning Fast**: Bootstrapped with `Vite` and `React 19` for near-instant rendering and hot module replacement.
- **Edge AI**: Offloads heavy facial recognition to the client device using `face-api.js`, saving massive backend compute costs.
- **Dynamic Visualization**: Real-time interactive charts and analytics via `Recharts`.
- **Beautiful UI Components**: Tailor-made, fully responsive components utilizing `Tailwind CSS v4`, `clsx`, and `tailwind-merge` for conditional styling.
- **Iconography**: Crisp, scalable SVG icons provided by `Lucide React`.
- **Robust State**: Fully strictly-typed data fetching with `Axios` and structured navigation with `React Router v7`.

---

## 📦 Installation & Setup

Ensure you have **Node.js 20+** installed on your system.

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment variables
Ensure you create a `.env.local` if needed, mapping the backend API URLs. By default, Axios points to `/api/v1` or your configured base URL.

---

## 🛠️ Development

To start the development server with Hot Module Replacement (HMR):

```bash
npm run dev
```

The application will be accessible at:
👉 **[http://localhost:5173](http://localhost:5173)**

---

## 🏗️ Build for Production

When you are ready to deploy to production, run:

```bash
npm run build
```

This will generate an optimized, minified bundle in the `dist` folder. You can preview the production build using:
```bash
npm run preview
```

---

## 📁 Folder Structure

```text
frontend/
├── public/                 # Static assets (images, AI models for face-api.js)
├── src/                    
│   ├── assets/             # Bundled static assets
│   ├── components/         # Reusable presentation and functional components
│   ├── lib/                # API integrations and utility classes
│   ├── pages/              # High-level route views (Dashboard, Live, Objects)
│   ├── utils/              # Helper functions (cn for Tailwind)
│   ├── App.tsx             # Root Component
│   ├── index.css           # Global Tailwind entries
│   └── main.tsx            # React DOM injection point
├── package.json            # NPM Scripts and Dependencies
└── tailwind.config.js      # Tailwind v4 configuration
```

---

<div align="center">
  <sub>Designed with precision. Crafted with passion.</sub>
</div>
