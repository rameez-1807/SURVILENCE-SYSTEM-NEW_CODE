import axios from 'axios';

const PRODUCTION_BACKEND_URL = 'https://survilence-system-new-code.onrender.com';
const PRODUCTION_WS_URL = 'wss://survilence-system-new-code.onrender.com';

const isProductionDomain = (): boolean => {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return Boolean(h && !h.includes('localhost') && !h.includes('127.0.0.1'));
};

export const getBackendHost = (): string => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/api\/v1\/?$/, '').replace(/\/+$/, '');
  }
  if (isProductionDomain()) {
    return PRODUCTION_BACKEND_URL;
  }
  if (typeof window !== 'undefined' && window.location.hostname) {
    return `http://${window.location.hostname}:8000`;
  }
  return 'http://localhost:8000';
};

export const getApiBaseUrl = (): string => {
  if (import.meta.env.VITE_API_URL) {
    const base = import.meta.env.VITE_API_URL.replace(/\/+$/, '');
    return base.endsWith('/api/v1') ? base : `${base}/api/v1`;
  }
  if (isProductionDomain()) {
    return `${PRODUCTION_BACKEND_URL}/api/v1`;
  }
  if (typeof window !== 'undefined' && window.location.hostname) {
    return `http://${window.location.hostname}:8000/api/v1`;
  }
  return 'http://localhost:8000/api/v1';
};

export const getWsUrl = (path: string = '/api/v1/ws'): string => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (import.meta.env.VITE_WS_URL) {
    const baseWs = import.meta.env.VITE_WS_URL.replace(/\/+$/, '');
    return `${baseWs}${cleanPath}`;
  }
  if (import.meta.env.VITE_API_URL) {
    const isHttps = import.meta.env.VITE_API_URL.startsWith('https');
    const wsProto = isHttps ? 'wss' : 'ws';
    const host = import.meta.env.VITE_API_URL.replace(/^https?:\/\//, '').replace(/\/api\/v1\/?$/, '').replace(/\/+$/, '');
    return `${wsProto}://${host}${cleanPath}`;
  }
  if (isProductionDomain()) {
    return `${PRODUCTION_WS_URL}${cleanPath}`;
  }
  const host = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
  const proto = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${host}:8000${cleanPath}`;
};

export const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 60000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Optional: add tenant ID header if multi-tenant UI is needed later
  config.headers['X-Tenant-ID'] = 'bb398bec-8429-44db-b9ec-b04c3ac81c36'; // Default Organization ID from seed
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If unauthorized, redirect to login
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      // Only redirect if not already on the login page
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
