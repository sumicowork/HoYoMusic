import api from './api';

interface ExportCreditsResult {
  blob: Blob;
  fileName: string;
}

const DEFAULT_FILE_NAME = 'credits-export.json';

const parseFileName = (contentDisposition?: string): string => {
  if (!contentDisposition) return DEFAULT_FILE_NAME;

  // Support RFC 5987 filename*=UTF-8''... and plain filename="..."
  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]).replace(/(^"|"$)/g, '');
  }

  const plainMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  if (plainMatch?.[1]) {
    return plainMatch[1].trim();
  }

  return DEFAULT_FILE_NAME;
};

const extractErrorMessageFromBlob = async (blob: Blob): Promise<string | null> => {
  try {
    const text = await blob.text();
    const parsed = JSON.parse(text) as { error?: { message?: string } };
    return parsed.error?.message || null;
  } catch {
    return null;
  }
};

export const creditsService = {
  async exportCredits(albumIds: number[]): Promise<ExportCreditsResult> {
    try {
      const response = await api.post('/credits/export', { albumIds }, { responseType: 'blob' });
      const fileName = parseFileName(response.headers['content-disposition'] as string | undefined);
      return { blob: response.data as Blob, fileName };
    } catch (error: any) {
      if (error?.response?.data instanceof Blob) {
        const serverMessage = await extractErrorMessageFromBlob(error.response.data as Blob);
        throw new Error(serverMessage || '导出 Credits 失败');
      }
      throw new Error(error?.message || '导出 Credits 失败');
    }
  },
};

