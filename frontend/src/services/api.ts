import axios from 'axios';
import type { AxiosInstance } from 'axios';

// ── Generated, OpenAPI-derived API surface (truth = backend OpenAPI) ──
// The generated client (`openapi-fetch`, typed via `paths` from api-types) is
// re-exported here so this module becomes the single canonical entry point for
// the API. The axios `api` instance below stays the runtime client for the
// existing callers until they are migrated onto the generated, type-safe client.
export { apiClient, type ApiClient } from '../generated/api-client';
export type * from '../generated/api-types';

// Auth expired event bus — decouples api.ts from UI store
export const authEvents = new EventTarget();

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

export const API_BASE_URL = import.meta.env.VITE_API_URL || `${window.location.origin}/api`;

/** 媒体流/下载/封面：走主域名享受 ESA CDN 加速 */
export const MEDIA_BASE_URL = `${window.location.origin}/api`;

const createApiClient = (options?: { noCacheForAuthedGet?: boolean }): AxiosInstance => {
  const client = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  client.interceptors.request.use((config) => {
    const visitorId = getOrCreateVisitorId();
    if (visitorId) {
      config.headers['x-visitor-id'] = visitorId;
    }

    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;

      if (options?.noCacheForAuthedGet && config.method?.toLowerCase() === 'get') {
        config.headers['Cache-Control'] = 'no-cache';
        config.headers.Pragma = 'no-cache';
      }
    }

    return config;
  });

  return client;
};

const api = createApiClient({ noCacheForAuthedGet: true });

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      const pathname = typeof window !== 'undefined' ? window.location.pathname + window.location.search + window.location.hash : null;
      authEvents.dispatchEvent(new CustomEvent('auth-expired', { detail: { redirectTo: pathname } }));
    }
    return Promise.reject(error);
  }
);

export default api;
export { createApiClient };

