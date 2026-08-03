import { createApiClient } from './api';
import type { Track, Album } from '../types';
import type { Game } from './gameService';

const publicApi = createApiClient({ noCacheForAuthedGet: false });

export interface Artist {
  id: number;
  name: string;
  track_count: number;
  album_count: number;
  roles: string[];
  aliases?: string[];
  avatar_path?: string | null;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export const artistService = {
  async getArtists(params?: { search?: string; limit?: number }): Promise<Artist[]> {
    const response = await publicApi.get<ApiResponse<{ artists: Artist[] }>>('/artists', { params });
    if (response.data.success && response.data.data) {
      return response.data.data.artists;
    }
    return [];
  },

  async getArtistById(id: number): Promise<{
    artist: Artist;
    tracks: Track[];
    albums: Album[];
    games?: Game[];
  } | null> {
    const response = await publicApi.get<ApiResponse<{
      artist: Artist;
      tracks: Track[];
      albums: Album[];
      games?: Game[];
    }>>(`/artists/${id}`);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    return null;
  },
};
