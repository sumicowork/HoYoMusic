import api from './api';

export const favoriteService = {
  toggle: (trackId: number) =>
    api.post('/favorites/toggle', { trackId }).then(r => r.data.data as { favorited: boolean }),

  getFavorites: (page = 1, limit = 50) =>
    api.get('/favorites', { params: { page, limit } }).then(r => r.data.data),

  checkFavorites: (trackIds: number[]) =>
    api.post('/favorites/check', { trackIds }).then(r => r.data.data.favorites as Record<number, boolean>),
};

export default favoriteService;

