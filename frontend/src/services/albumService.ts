import api, { IS_STATIC } from './api';
import * as staticData from './staticDataService';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || `${window.location.origin}/api`;
const publicApi = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

export interface Album {
  id: number;
  title: string;
  cover_path: string;
  release_date: string;
  game_id?: number;
  game_name?: string;
  track_count: number;
  total_duration: number;
  notes?: string | null;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface AlbumBpmDetectResult {
  album_id: number;
  album_title: string;
  total: number;
  tagged: number;
  low_confidence_tagged: number;
  skipped: number;
  failed: number;
  details: Array<{
    track_id: number;
    title: string;
    bpm: number | null;
    confidence: number | null;
    method: 'essentia' | 'librosa' | 'metadata' | null;
    low_confidence: boolean;
    tag: string | null;
    status: 'tagged' | 'skipped' | 'failed';
    reason?: string;
  }>;
}

export const albumService = {
  async getRandomAlbums(count = 6): Promise<Album[]> {
    if (IS_STATIC) return staticData.getRandomAlbums(count);
    const response = await publicApi.get<ApiResponse<{ albums: Album[] }>>(
      `/public/albums/random?count=${count}`
    );
    if (response.data.success && response.data.data) {
      return response.data.data.albums;
    }
    throw new Error('Failed to fetch random albums');
  },

  async getAlbums(page = 1, limit = 20, search = ''): Promise<{ albums: Album[]; pagination: any }> {
    if (IS_STATIC) return staticData.getAlbums(page, limit, search);
    const response = await api.get<ApiResponse<{ albums: Album[]; pagination: any }>>(
      `/albums?page=${page}&limit=${limit}&search=${search}`
    );
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to fetch albums');
  },

  async getAlbumById(id: number): Promise<any> {
    if (IS_STATIC) return staticData.getAlbumById(id);
    const response = await api.get<ApiResponse<any>>(`/albums/${id}`);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to fetch album details');
  },

  async updateAlbum(id: number, data: { title?: string; release_date?: string | null; game_id?: number | null; notes?: string | null }): Promise<Album> {
    const response = await api.put<ApiResponse<{ album: Album }>>(`/albums/${id}`, data);
    if (response.data.success && response.data.data) {
      return response.data.data.album;
    }
    throw new Error(response.data.error?.message || 'Failed to update album');
  },

  async bulkSetGame(albumIds: number[], gameId: number | null): Promise<void> {
    const response = await api.put<ApiResponse<any>>('/albums/bulk-game', { albumIds, gameId });
    if (!response.data.success) {
      throw new Error(response.data.error?.message || '批量设置游戏失败');
    }
  },

  async rescanDates(albumId: number): Promise<{ updated: number; message?: string }> {
    const response = await api.post<ApiResponse<{ updated: number }>>(`/albums/${albumId}/rescan-dates`);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error?.message || '重新读取日期失败');
  },

  async detectBpm(albumId: number): Promise<AlbumBpmDetectResult> {
    const response = await api.post<ApiResponse<AlbumBpmDetectResult>>(`/albums/${albumId}/detect-bpm`);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error?.message || '批量BPM检测失败');
  },

  async uploadCover(id: number, file: File): Promise<{ album: Album; cover_path: string }> {
    const formData = new FormData();
    formData.append('cover', file);

    const response = await api.post<ApiResponse<{ album: Album; cover_path: string }>>(
      `/albums/${id}/cover`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error?.message || 'Failed to upload cover');
  }
};
