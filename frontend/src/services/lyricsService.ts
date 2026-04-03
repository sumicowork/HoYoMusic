import { createApiClient } from './api';

const publicApi = createApiClient({ noCacheForAuthedGet: false });

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


