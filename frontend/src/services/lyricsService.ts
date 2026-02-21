import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const publicApi = axios.create({ baseURL: API_BASE_URL });

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


