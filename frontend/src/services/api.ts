import axios from 'axios';
import { useAuthModalStore } from '../store/authModalStore';

/** Static-mode flag controlled by VITE_STATIC_MODE=true in .env.static. */
export const IS_STATIC = import.meta.env.VITE_STATIC_MODE === 'true';

const VISITOR_ID_KEY = 'visitor_id';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (value: string): boolean => UUID_RE.test(value);

const createUuidFallback = (): string => {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const createVisitorId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return createUuidFallback();
};

export const getOrCreateVisitorId = (): string | null => {
  try {
    const current = localStorage.getItem(VISITOR_ID_KEY)?.trim();
    if (current && isUuid(current)) {
      return current;
    }

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

api.interceptors.request.use((config) => {
  const visitorId = getOrCreateVisitorId();
  if (visitorId) {
    config.headers['x-visitor-id'] = visitorId;
  }

  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;

    if (config.method?.toLowerCase() === 'get') {
      config.headers['Cache-Control'] = 'no-cache';
      config.headers.Pragma = 'no-cache';
    }
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      const pathname = typeof window !== 'undefined' ? window.location.pathname + window.location.search + window.location.hash : null;
      useAuthModalStore.getState().openLogin(pathname || null);
    }
    return Promise.reject(error);
  }
);

export default api;

