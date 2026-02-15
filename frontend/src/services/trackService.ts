import api from './api';
import axios from 'axios';
import { ApiResponse, Track } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Create a public axios instance without auth interceptors
const publicApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const trackService = {
  // Admin APIs (需要认证)
  async uploadTracks(files: File[]): Promise<any> {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('tracks', file);
    });

    const response = await api.post<ApiResponse<any>>('/tracks/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    if (response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.error?.message || 'Upload failed');
  },

  async getTracks(page = 1, limit = 20): Promise<{ tracks: Track[]; pagination: any }> {
    const response = await api.get<ApiResponse<{ tracks: Track[]; pagination: any }>>(
      `/tracks?page=${page}&limit=${limit}`
    );
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to fetch tracks');
  },

  // Public APIs (无需认证)
  async getTracksPublic(page = 1, limit = 20, search = ''): Promise<{ tracks: Track[]; pagination: any }> {
    const response = await publicApi.get<ApiResponse<{ tracks: Track[]; pagination: any }>>(
      `/public/tracks?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`
    );
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to fetch tracks');
  },

  async getTrackById(id: number): Promise<Track> {
    const response = await api.get<ApiResponse<{ track: Track }>>(`/tracks/${id}`);
    if (response.data.success && response.data.data) {
      return response.data.data.track;
    }
    throw new Error('Failed to fetch track');
  },

  async getTrackByIdPublic(id: number): Promise<Track> {
    const response = await publicApi.get<ApiResponse<{ track: Track }>>(`/public/tracks/${id}`);
    if (response.data.success && response.data.data) {
      return response.data.data.track;
    }
    throw new Error('Failed to fetch track');
  },

  getStreamUrl(id: number): string {
    const token = localStorage.getItem('token');
    return `${API_BASE_URL}/tracks/${id}/stream?token=${token}`;
  },

  getStreamUrlPublic(id: number): string {
    return `${API_BASE_URL}/public/tracks/${id}/stream`;
  },

  getDownloadUrl(id: number): string {
    const token = localStorage.getItem('token');
    return `${API_BASE_URL}/tracks/${id}/download?token=${token}`;
  },

  getDownloadUrlPublic(id: number): string {
    return `${API_BASE_URL}/public/tracks/${id}/download`;
  },

  getCoverUrl(coverPath: string | null): string {
    if (!coverPath) return '/placeholder-cover.jpg';
    return `${API_BASE_URL.replace('/api', '')}${coverPath}`;
  },

  // Update track metadata
  async updateTrack(id: number, data: { title: string; artists: string[]; album_title?: string }): Promise<void> {
    const response = await api.put<ApiResponse<any>>(`/tracks/${id}`, data);
    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Update failed');
    }
  },

  // Delete track
  async deleteTrack(id: number): Promise<void> {
    const response = await api.delete<ApiResponse<any>>(`/tracks/${id}`);
    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Delete failed');
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
    throw new Error(response.data.error?.message || 'Failed to upload cover');
  },
};

