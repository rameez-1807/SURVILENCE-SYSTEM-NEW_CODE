/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#09090b', // zinc-950
        surface: '#18181b', // zinc-900
        surfaceHover: '#27272a', // zinc-800
        border: '#3f3f46', // zinc-700
        primary: '#3b82f6', // blue-500
        primaryHover: '#2563eb', // blue-600
        text: '#f4f4f5', // zinc-50
        textMuted: '#a1a1aa', // zinc-400
        danger: '#ef4444',
        success: '#10b981',
        warning: '#f59e0b',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
