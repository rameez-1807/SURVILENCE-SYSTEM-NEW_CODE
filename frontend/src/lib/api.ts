import axios from 'axios';

export const getBackendHost = (): string => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/api\/v1\/?$/, '').replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined') {
    if (window.location.port === '5173') {
      return 'http://localhost:8000';
    }
    if (window.location.origin) {
      return window.location.origin;
    }
  }
  return 'http://localhost:8000';
};

export const getApiBaseUrl = (): string => {
  if (import.meta.env.VITE_API_URL) {
    const base = import.meta.env.VITE_API_URL.replace(/\/+$/, '');
    return base.endsWith('/api/v1') ? base : `${base}/api/v1`;
  }
  if (typeof window !== 'undefined') {
    if (window.location.port === '5173') {
      return 'http://localhost:8000/api/v1';
    }
    if (window.location.origin) {
      return `${window.location.origin}/api/v1`;
    }
  }
  return 'http://localhost:8000/api/v1';
};

export const getWsUrl = (path: string = '/api/v1/ws'): string => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  let baseWs = '';

  if (import.meta.env.VITE_WS_URL) {
    baseWs = import.meta.env.VITE_WS_URL.replace(/\/+$/, '');
  } else if (import.meta.env.VITE_API_URL) {
    const isHttps = import.meta.env.VITE_API_URL.startsWith('https');
    const wsProto = isHttps ? 'wss' : 'ws';
    const host = import.meta.env.VITE_API_URL
      .replace(/^https?:\/\//, '')
      .replace(/\/api\/v1\/?$/, '')
      .replace(/\/+$/, '');
    baseWs = `${wsProto}://${host}`;
  } else if (typeof window !== 'undefined') {
    if (window.location.port === '5173') {
      baseWs = 'ws://localhost:8000';
    } else if (window.location.host) {
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      baseWs = `${proto}://${window.location.host}`;
    }
  }

  if (!baseWs) {
    baseWs = 'ws://localhost:8000';
  }

  // Strip trailing '/api/v1/ws' or '/api/v1' from baseWs to prevent path duplication
  baseWs = baseWs.replace(/\/api\/v1(\/ws)?\/?$/, '');

  return `${baseWs}${cleanPath}`;
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
