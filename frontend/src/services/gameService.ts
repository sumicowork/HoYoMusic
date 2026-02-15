import api from './api';

export interface Game {
  id: number;
  name: string;
  name_en: string;
  description: string;
  cover_path: string;
  display_order: number;
  album_count: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export const gameService = {
  async getGames(): Promise<Game[]> {
    const response = await api.get<ApiResponse<{ games: Game[] }>>('/games');
    if (response.data.success && response.data.data) {
      return response.data.data.games;
    }
    throw new Error('Failed to fetch games');
  },

  async getGameById(id: number): Promise<any> {
    const response = await api.get<ApiResponse<any>>(`/games/${id}`);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to fetch game details');
  }
};

