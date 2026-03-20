import axios from 'axios';
import { IS_STATIC, getOrCreateVisitorId } from './api';
import * as staticData from './staticDataService';

const API_BASE_URL = import.meta.env.VITE_API_URL || `${window.location.origin}/api`;

const publicApi = axios.create({ baseURL: API_BASE_URL });

publicApi.interceptors.request.use((config) => {
  const visitorId = getOrCreateVisitorId();
  if (visitorId) {
    config.headers['x-visitor-id'] = visitorId;
  }
  return config;
});

export const lyricsService = {
  async getLyrics(trackId: number): Promise<string | null> {
    if (IS_STATIC) return staticData.getLyrics(trackId);
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


