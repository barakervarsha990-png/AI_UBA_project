import axios from 'axios';

const getBaseURL = () => {
  // 1. Explicitly configured via build-time or runtime environment variable (e.g. VITE_API_URL on Vercel)
  if (import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL.trim() !== '') {
    return import.meta.env.VITE_API_URL.trim();
  }

  // 2. Running in browser on a deployed domain (Vercel, Render, etc.)
  if (
    typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1'
  ) {
    return '/api';
  }

  // 3. Local development fallback (matches backend default PORT 5050)
  return 'http://localhost:5050/api';
};

const api = axios.create({
  baseURL: getBaseURL(),
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('soc_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('soc_token');
      localStorage.removeItem('soc_user');
      if (window.location.pathname !== '/login') window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
