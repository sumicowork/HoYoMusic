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

  // id 支持数字或名字（含别名）：后端双模式解析，禁止前端 parseInt（中文名会被转成 NaN 导致 404）
  async getArtistById(id: string | number): Promise<{
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
