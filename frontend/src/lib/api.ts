import axios from 'axios';

export const getApiBaseUrl = (): string => {
  // 1. Explicit override via environment variable
  if (process.env.NEXT_PUBLIC_API_URL) {
    const raw = process.env.NEXT_PUBLIC_API_URL.trim().replace(/\/$/, '');
    return raw.endsWith('/api') ? raw : `${raw}/api`;
  }
  
  // 2. Client-side runtime: detect current window hostname dynamically
  if (typeof window !== 'undefined') {
    const { hostname } = window.location;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:8000/api';
    }
    return 'https://breachguard-w88w.vercel.app/api';
  }
  
  // 3. Server-side rendering (SSR) or build-time default:
  // In production builds (Vercel), default to the live backend URL so static pages never bake in localhost:8000
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
    return 'https://breachguard-w88w.vercel.app/api';
  }

  return 'http://localhost:8000/api';
};

export const API_BASE_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  // Update baseURL dynamically per request to ensure correct host in all environments
  config.baseURL = getApiBaseUrl();

  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If request gets 401 Unauthorized, only attempt re-authentication if user was previously authenticated
    const isAuthRoute = originalRequest?.url?.includes('/auth/login') || originalRequest?.url?.includes('/prospect/');
    const hadToken = typeof window !== 'undefined' && Boolean(localStorage.getItem('token'));

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthRoute && hadToken) {
      if (typeof window === 'undefined') return Promise.reject(error);

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const res = await axios.post(
          `${getApiBaseUrl()}/auth/login`,
          {
            email: 'admin@acme.com',
            password: 'password123',
          },
          { withCredentials: true }
        );
        const newToken = res.data.access_token;
        localStorage.setItem('token', newToken);
        api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
        processQueue(null, newToken);
        return api(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
