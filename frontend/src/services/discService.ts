import api from './api';

export interface Disc {
  id: number;
  album_id: number;
  disc_number: number;
  disc_title: string | null;
  created_at: string;
}

export const discService = {
  async getDiscs(albumId: number): Promise<Disc[]> {
    const response = await api.get(`/albums/${albumId}/discs`);
    if (response.data.success) return response.data.data.discs;
    throw new Error('Failed to fetch discs');
  },

  async createDisc(albumId: number, data: { disc_number: number; disc_title?: string }): Promise<Disc> {
    const response = await api.post(`/albums/${albumId}/discs`, data);
    if (response.data.success) return response.data.data.disc;
    throw new Error(response.data.error?.message || 'Failed to create disc');
  },

  async updateDisc(id: number, data: { disc_number: number; disc_title?: string }): Promise<Disc> {
    const response = await api.put(`/discs/${id}`, data);
    if (response.data.success) return response.data.data.disc;
    throw new Error(response.data.error?.message || 'Failed to update disc');
  },

  async deleteDisc(id: number): Promise<void> {
    const response = await api.delete(`/discs/${id}`);
    if (!response.data.success) throw new Error(response.data.error?.message || 'Failed to delete disc');
  },

  async assignTrackToDisc(trackId: number, discId: number | null): Promise<void> {
    const response = await api.put(`/tracks/${trackId}/disc`, { disc_id: discId });
    if (!response.data.success) throw new Error(response.data.error?.message || 'Failed to assign track');
  },

  async bulkAssignTracks(albumId: number, assignments: { track_id: number; disc_id: number | null }[]): Promise<void> {
    const response = await api.post(`/albums/${albumId}/discs/assign`, { assignments });
    if (!response.data.success) throw new Error(response.data.error?.message || 'Failed to bulk assign tracks');
  },
};

