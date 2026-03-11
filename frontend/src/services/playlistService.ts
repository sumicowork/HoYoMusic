import api from './api';

export interface Playlist {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  cover_path: string | null;
  is_public: boolean;
  track_count: number;
  total_duration: number;
  created_at: string;
  updated_at: string;
}

export const playlistService = {
  getPlaylists: () => api.get('/playlists').then(r => r.data.data.playlists as Playlist[]),

  getPlaylistById: (id: number) =>
    api.get(`/playlists/${id}`).then(r => r.data.data),

  createPlaylist: (name: string, description?: string, is_public?: boolean) =>
    api.post('/playlists', { name, description, is_public }).then(r => r.data.data.playlist as Playlist),

  updatePlaylist: (id: number, data: { name?: string; description?: string; is_public?: boolean }) =>
    api.put(`/playlists/${id}`, data).then(r => r.data.data.playlist as Playlist),

  deletePlaylist: (id: number) =>
    api.delete(`/playlists/${id}`).then(r => r.data),

  addTrack: (playlistId: number, trackId: number) =>
    api.post(`/playlists/${playlistId}/tracks`, { trackId }).then(r => r.data),

  removeTrack: (playlistId: number, trackId: number) =>
    api.delete(`/playlists/${playlistId}/tracks/${trackId}`).then(r => r.data),

  reorderTracks: (playlistId: number, trackIds: number[]) =>
    api.put(`/playlists/${playlistId}/reorder`, { trackIds }).then(r => r.data),
};

export default playlistService;

