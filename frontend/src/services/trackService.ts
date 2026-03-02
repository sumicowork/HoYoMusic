import api, { IS_STATIC } from './api';
import * as staticData from './staticDataService';
import axios from 'axios';
import { ApiResponse, Track } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

/**
 * 全局下载功能开关
 * false = 关闭所有下载（服务器维护期间）
 * true  = 正常开放下载
 */
export const DOWNLOAD_ENABLED = false;

// Create a public axios instance without auth interceptors
const publicApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface TrackSearchParams {
  search?: string;
  sample_rate_min?: number;
  bit_depth?: number;
  year_from?: number;
  year_to?: number;
  duration_min?: number;  // seconds
  duration_max?: number;  // seconds
  tag_ids?: number[];     // 多 tag 筛选
  tag_logic?: 'AND' | 'OR'; // 多 tag 逻辑（默认 AND）
  sort_by?: 'created_at' | 'title' | 'duration' | 'sample_rate' | 'release_date';
  sort_dir?: 'ASC' | 'DESC';
  page?: number;
  limit?: number;
}

export const trackService = {
  // Admin APIs (需要认证)
  async uploadTracks(
    files: File[],
    options?: {
      autoCredits?: boolean;
      metaOverrides?: Array<{ title?: string; artist?: string; album?: string }>;
      // 前端编辑后的 credits，与 files 一一对应；若传入则覆盖后端自动解析
      creditsOverrides?: Array<Array<{ key: string; value: string }> | null>;
    }
  ): Promise<any> {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('tracks', file);
    });

    // auto_credits via URL query（绕开 multipart body 字段顺序问题）
    const autoCreditsVal = options?.autoCredits === false ? 'false' : 'true';

    if (options?.metaOverrides) {
      options.metaOverrides.forEach((meta, idx) => {
        if (meta.title)  formData.append(`title_override_${idx}`,  meta.title);
        if (meta.artist) formData.append(`artist_override_${idx}`, meta.artist);
        if (meta.album !== undefined) formData.append(`album_override_${idx}`, meta.album);
      });
    }

    // 传入编辑后的 credits（JSON 序列化）
    if (options?.creditsOverrides) {
      options.creditsOverrides.forEach((credits, idx) => {
        if (credits && credits.length > 0) {
          formData.append(`credits_override_${idx}`, JSON.stringify(credits));
        }
      });
    }

    const response = await api.post<ApiResponse<any>>(
      `/tracks/upload?auto_credits=${autoCreditsVal}`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );

    if (response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.error?.message || '上传失败');
  },

  async previewCredits(files: File[]): Promise<Array<{ filename: string; credits: Array<{ key: string; value: string }> }>> {
    const formData = new FormData();
    files.forEach(f => formData.append('tracks', f));
    const response = await api.post<ApiResponse<{ results: Array<{ filename: string; credits: Array<{ key: string; value: string }> }> }>>(
      '/tracks/preview-credits',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    if (response.data.success && response.data.data) return response.data.data.results;
    throw new Error(response.data.error?.message || '预览失败');
  },

  async getTracks(page = 1, limit = 20): Promise<{ tracks: Track[]; pagination: any }> {
    const response = await api.get<ApiResponse<{ tracks: Track[]; pagination: any }>>(
      `/tracks?page=${page}&limit=${limit}`
    );
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('获取曲目列表失败');
  },

  // Public APIs (无需认证)
  async getTracksPublic(page = 1, limit = 20, search = ''): Promise<{ tracks: Track[]; pagination: any }> {
    if (IS_STATIC) return staticData.getTracksPublic(page, limit, search);
    const response = await publicApi.get<ApiResponse<{ tracks: Track[]; pagination: any }>>(
      `/public/tracks?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`
    );
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('获取曲目列表失败');
  },

  async searchTracksPublic(params: TrackSearchParams): Promise<{ tracks: Track[]; pagination: any }> {
    if (IS_STATIC) return staticData.searchTracksPublic(params);
    const query = new URLSearchParams();
    if (params.search)                        query.set('search',          params.search);
    if (params.sample_rate_min != null)       query.set('sample_rate_min', String(params.sample_rate_min));
    if (params.bit_depth       != null)       query.set('bit_depth',       String(params.bit_depth));
    if (params.year_from       != null)       query.set('year_from',        String(params.year_from));
    if (params.year_to         != null)       query.set('year_to',          String(params.year_to));
    if (params.duration_min    != null)       query.set('duration_min',     String(params.duration_min));
    if (params.duration_max    != null)       query.set('duration_max',     String(params.duration_max));
    if (params.tag_ids?.length)               query.set('tag_ids',          params.tag_ids.join(','));
    if (params.tag_logic)                     query.set('tag_logic',        params.tag_logic);
    if (params.sort_by)                       query.set('sort_by',          params.sort_by);
    if (params.sort_dir)                      query.set('sort_dir',         params.sort_dir);
    query.set('page',  String(params.page  ?? 1));
    query.set('limit', String(params.limit ?? 20));

    const response = await publicApi.get<ApiResponse<{ tracks: Track[]; pagination: any }>>(
      `/public/tracks?${query.toString()}`
    );
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('搜索失败');
  },

  async getTrackById(id: number): Promise<Track> {
    const response = await api.get<ApiResponse<{ track: Track }>>(`/tracks/${id}`);
    if (response.data.success && response.data.data) {
      return response.data.data.track;
    }
    throw new Error('获取曲目详情失败');
  },

  async getTrackByIdPublic(id: number): Promise<Track> {
    if (IS_STATIC) return staticData.getTrackByIdPublic(id);
    const response = await publicApi.get<ApiResponse<{ track: Track }>>(`/public/tracks/${id}`);
    if (response.data.success && response.data.data) {
      return response.data.data.track;
    }
    throw new Error('获取曲目详情失败');
  },

  getStreamUrl(id: number): string {
    const token = localStorage.getItem('token');
    return `${API_BASE_URL}/tracks/${id}/stream?token=${token}`;
  },

  getStreamUrlPublic(id: number, track?: Track): string {
    if (IS_STATIC && track?.audio_url) return track.audio_url;
    return `${API_BASE_URL}/public/tracks/${id}/stream`;
  },

  getDownloadUrl(id: number): string {
    const token = localStorage.getItem('token');
    return `${API_BASE_URL}/tracks/${id}/download?token=${token}`;
  },

  getDownloadUrlPublic(id: number, track?: Track): string {
    if (IS_STATIC && track?.audio_url) return track.audio_url;
    return `${API_BASE_URL}/public/tracks/${id}/download`;
  },

  getCoverUrl(coverPath: string | null): string {
    if (!coverPath) return '/placeholder-cover.jpg';
    if (IS_STATIC) return staticData.getCoverUrl(coverPath) || '/placeholder-cover.jpg';
    const backendOrigin = API_BASE_URL.replace('/api', '');
    // OSS / WebDAV 模式：cover_path 是完整 URL，通过服务器代理中转，避免前端直连 OSS
    if (coverPath.startsWith('http://') || coverPath.startsWith('https://')) {
      return `${backendOrigin}/api/public/covers/proxy?path=${encodeURIComponent(coverPath)}`;
    }
    // Local mode: coverPath is like /uploads/covers/xxx.jpg (new) or covers/xxx.jpg (legacy)
    const normalized = coverPath.startsWith('/') ? coverPath : `/uploads/${coverPath}`;
    return `${backendOrigin}${normalized}`;
  },

  // Update track metadata
  async updateTrack(id: number, data: { title: string; artists: string[]; album_title?: string; release_date?: string; track_number?: number }): Promise<void> {
    const response = await api.put<ApiResponse<any>>(`/tracks/${id}`, data);
    if (!response.data.success) {
      throw new Error(response.data.error?.message || '更新失败');
    }
  },

  // Delete track
  async deleteTrack(id: number): Promise<void> {
    const response = await api.delete<ApiResponse<any>>(`/tracks/${id}`);
    if (!response.data.success) {
      throw new Error(response.data.error?.message || '删除失败');
    }
  },

  // Bulk delete tracks
  async bulkDeleteTracks(ids: number[]): Promise<void> {
    const response = await api.delete<ApiResponse<any>>('/tracks/bulk', { data: { ids } });
    if (!response.data.success) {
      throw new Error(response.data.error?.message || '批量删除失败');
    }
  },

  // Bulk move tracks to album
  async bulkMoveTracksToAlbum(trackIds: number[], albumId: number | null): Promise<void> {
    const response = await api.post<ApiResponse<any>>('/tracks/bulk-move', { trackIds, albumId });
    if (!response.data.success) {
      throw new Error(response.data.error?.message || '批量移动失败');
    }
  },

  // Upload track cover
  async uploadCover(id: number, file: File): Promise<{ track: Track; cover_path: string }> {
    const formData = new FormData();
    formData.append('cover', file);

    const response = await api.post<ApiResponse<{ track: Track; cover_path: string }>>(
      `/tracks/${id}/cover`,
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
    throw new Error(response.data.error?.message || '上传封面失败');
  },
};

