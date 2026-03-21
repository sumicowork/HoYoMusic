import api, { IS_STATIC } from './api';

export type LyricsImportStatus = 'matched' | 'ambiguous' | 'not_found' | 'invalid' | 'imported' | 'error';

export interface LyricsImportCandidate {
  track_id: number;
  title: string;
  album_title: string;
  artists: string;
}

export interface LyricsImportItem {
  file_key: string;
  file_name: string;
  inferred_title: string;
  status: LyricsImportStatus;
  message?: string;
  matched_track_id?: number;
  candidates?: LyricsImportCandidate[];
}

export interface LyricsImportPreviewResult {
  summary: {
    total: number;
    matched: number;
    ambiguous: number;
    not_found: number;
    invalid: number;
  };
  items: LyricsImportItem[];
}

export interface LyricsImportCommitResult {
  summary: {
    total: number;
    imported: number;
    ambiguous: number;
    not_found: number;
    invalid: number;
    error: number;
  };
  items: LyricsImportItem[];
}

const appendFiles = (formData: FormData, files: File[]) => {
  files.forEach((file) => {
    const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
    const uploadName = relativePath && relativePath.trim() ? relativePath : file.name;
    formData.append('files', file, uploadName);
  });
};

export const lyricsImportService = {
  async previewImport(files: File[]): Promise<LyricsImportPreviewResult> {
    if (IS_STATIC) {
      throw new Error('静态模式不支持歌词导入');
    }

    const formData = new FormData();
    appendFiles(formData, files);

    const response = await api.post('/lyrics/import/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    if (!response.data?.success) {
      throw new Error(response.data?.error?.message || '预览导入失败');
    }

    return response.data.data as LyricsImportPreviewResult;
  },

  async commitImport(files: File[], resolutions: Record<string, number>): Promise<LyricsImportCommitResult> {
    if (IS_STATIC) {
      throw new Error('静态模式不支持歌词导入');
    }

    const formData = new FormData();
    appendFiles(formData, files);
    formData.append('resolutions', JSON.stringify(resolutions));

    const response = await api.post('/lyrics/import/commit', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    if (!response.data?.success) {
      throw new Error(response.data?.error?.message || '提交导入失败');
    }

    return response.data.data as LyricsImportCommitResult;
  },
};



