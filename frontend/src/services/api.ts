import axios from 'axios';

/** 静态模式标志 — 由 .env.static 中 VITE_STATIC_MODE=true 控制 */
export const IS_STATIC = import.meta.env.VITE_STATIC_MODE === 'true';
const VISITOR_ID_KEY = 'visitor_id';

const createVisitorId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
};

export const getOrCreateVisitorId = (): string | null => {
  try {
    const current = localStorage.getItem(VISITOR_ID_KEY);
    if (current) return current;
    const next = createVisitorId();
    localStorage.setItem(VISITOR_ID_KEY, next);
    return next;
  } catch {
    return null;
  }
};

const API_BASE_URL = import.meta.env.VITE_API_URL || `${window.location.origin}/api`;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const visitorId = getOrCreateVisitorId();
  if (visitorId) {
    config.headers['x-visitor-id'] = visitorId;
  }

  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;

    if (config.method?.toLowerCase() === 'get') {
      // Force revalidation for admin list/detail reads right after CRUD actions.
      config.headers['Cache-Control'] = 'no-cache';
      config.headers.Pragma = 'no-cache';
    }
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/admin/login';
    }
    return Promise.reject(error);
  }
);

export default api;

