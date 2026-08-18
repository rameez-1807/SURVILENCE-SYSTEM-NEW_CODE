import axios from 'axios';

export const api = axios.create({
  baseURL: 'http://localhost:8000/api/v1',
  timeout: 10000,
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
