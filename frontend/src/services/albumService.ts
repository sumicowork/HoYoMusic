import api, { createApiClient } from './api';
import type { PaginationMeta } from '../types';

const publicApi = createApiClient({ noCacheForAuthedGet: false });

export interface Album {
  id: number;
  uuid?: string;
  title: string;
  title_cn?: string | null;
  title_en?: string | null;
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

export interface AlbumBpmTask {
  task_id: string;
  album_id: number;
  status: 'running' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
  total: number;
  processed: number;
  tagged: number;
  skipped: number;
  failed: number;
  low_confidence_tagged: number;
  result?: AlbumBpmDetectResult;
  error?: string;
}

export const albumService = {
  async getRandomAlbums(count = 6): Promise<Album[]> {
    const response = await publicApi.get<ApiResponse<{ albums: Album[] }>>(
      `/public/albums/random?count=${count}`
    );
    if (response.data.success && response.data.data) {
      return response.data.data.albums;
    }
    throw new Error('Failed to fetch random albums');
  },

  async getAlbums(page = 1, limit = 20, search = ''): Promise<{ albums: Album[]; pagination: PaginationMeta }> {
    const response = await api.get<ApiResponse<{ albums: Album[]; pagination: PaginationMeta }>>(
      `/albums?page=${page}&limit=${limit}&search=${search}`
    );
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to fetch albums');
  },

  async getAlbumById(id: number): Promise<any> {
    const response = await api.get<ApiResponse<any>>(`/albums/${id}`);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to fetch album details');
  },

  async updateAlbum(id: number, data: { title?: string; title_cn?: string | null; title_en?: string | null; release_date?: string | null; game_id?: number | null; notes?: string | null }): Promise<Album> {
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

  async createDetectBpmTask(albumId: number): Promise<AlbumBpmTask> {
    const response = await api.post<ApiResponse<AlbumBpmTask>>(`/albums/${albumId}/detect-bpm/tasks`);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error?.message || '创建BPM检测任务失败');
  },

  async getDetectBpmTask(albumId: number, taskId: string): Promise<AlbumBpmTask> {
    const response = await api.get<ApiResponse<AlbumBpmTask>>(`/albums/${albumId}/detect-bpm/tasks/${taskId}`);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error?.message || '获取BPM检测任务失败');
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
