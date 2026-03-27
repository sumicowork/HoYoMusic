import axios from 'axios';
import { getOrCreateVisitorId } from './api';

const API_BASE_URL = import.meta.env.VITE_API_URL || `${window.location.origin}/api`;

const publicApi = axios.create({ baseURL: API_BASE_URL });

publicApi.interceptors.request.use((config) => {
  const visitorId = getOrCreateVisitorId();
  if (visitorId) {
    config.headers['x-visitor-id'] = visitorId;
  }

  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export const lyricsService = {
  async getLyrics(trackId: number): Promise<string | null> {
    try {
      // Backend: GET /api/lyrics/:id/lyrics
      const resp = await publicApi.get(`/lyrics/${trackId}/lyrics`);
      if (resp.data?.success && resp.data?.data?.lyrics) {
        return resp.data.data.lyrics as string;
      }
      return null;
    } catch {
      return null;
    }
  },
};


