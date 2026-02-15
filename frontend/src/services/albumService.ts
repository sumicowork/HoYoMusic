import api from './api';

export interface Album {
  id: number;
  title: string;
  cover_path: string;
  release_date: string;
  game_id?: number;
  track_count: number;
  total_duration: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export const albumService = {
  async getAlbums(page = 1, limit = 20, search = ''): Promise<{ albums: Album[]; pagination: any }> {
    const response = await api.get<ApiResponse<{ albums: Album[]; pagination: any }>>(
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

  async updateAlbum(id: number, data: { title?: string; release_date?: string | null; game_id?: number | null }): Promise<Album> {
    const response = await api.put<ApiResponse<{ album: Album }>>(`/albums/${id}`, data);
    if (response.data.success && response.data.data) {
      return response.data.data.album;
    }
    throw new Error(response.data.error?.message || 'Failed to update album');
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

