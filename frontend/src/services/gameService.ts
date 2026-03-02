import api, { IS_STATIC } from './api';
import * as staticData from './staticDataService';

export interface Game {
  id: number;
  name: string;
  name_en: string;
  description: string;
  cover_path: string;
  display_order: number;
  album_count: number;
  status: 'active' | 'maintenance' | 'unreleased';
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
    if (IS_STATIC) return staticData.getGames();
    const response = await api.get<ApiResponse<{ games: Game[] }>>('/games');
    if (response.data.success && response.data.data) {
      return response.data.data.games;
    }
    throw new Error('Failed to fetch games');
  },

  async getGameById(id: number): Promise<any> {
    if (IS_STATIC) return staticData.getGameById(id);
    const response = await api.get<ApiResponse<any>>(`/games/${id}`);
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('Failed to fetch game details');
  }
};

