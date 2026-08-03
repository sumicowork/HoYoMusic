import api, { createApiClient } from './api';
import { parseDownloadFileName, extractBlobErrorMessage } from '../utils/download';

const publicApi = createApiClient({ noCacheForAuthedGet: false });

interface Credit {
  id: number;
  credit_key: string;
  credit_value: string;
  display_order: number;
  artist_id?: number | null;
  people?: { name: string; artist_id: number | null }[];
}

interface ExportCreditsResult {
  blob: Blob;
  fileName: string;
}

const DEFAULT_FILE_NAME = 'credits-export.json';

export const creditsService = {
  async getCredits(trackId: number): Promise<Credit[]> {
    try {
      const response = await publicApi.get<{ success: boolean; data: { credits: Credit[] } }>(`/credits/${trackId}/credits`);
      if (response.data.success) {
        return response.data.data.credits;
      }
      return [];
    } catch {
      return [];
    }
  },

  async exportCredits(albumIds: number[]): Promise<ExportCreditsResult> {
    try {
      const response = await api.post('/credits/export', { albumIds }, { responseType: 'blob' });
      const fileName = parseDownloadFileName(response.headers['content-disposition'] as string | undefined, DEFAULT_FILE_NAME);
      return { blob: response.data as Blob, fileName };
    } catch (error: any) {
      if (error?.response?.data instanceof Blob) {
        const serverMessage = await extractBlobErrorMessage(error.response.data as Blob);
        throw new Error(serverMessage || '导出 Credits 失败');
      }
      throw new Error(error?.message || '导出 Credits 失败');
    }
  },
};

