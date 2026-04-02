import api from './api';
import type { ApiResponse } from '../types';

export type MusicSourceImportStatus = 'matched' | 'needs_manual' | 'not_found' | 'invalid' | 'imported' | 'skipped' | 'error';

export interface MusicSourceImportSource {
  category: string;
  path: string[];
}

export interface MusicSourceCategory {
  id: number;
  game_id: number;
  name: string;
  description: string | null;
  display_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface MusicSourceNode {
  id: number;
  game_id: number;
  category_id: number;
  parent_id: number | null;
  name: string;
  display_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface MusicSourceImportEntry {
  row_key: string;
  song_name: string;
  song_number?: string | number | null;
  album_name?: string | null;
  game_id: number;
  sources: MusicSourceImportSource[];
}

export interface MusicSourceImportCandidate {
  track_id: number;
  title: string;
  track_number: number | null;
  album_title: string;
  artists: string;
}

export interface MusicSourceImportItem {
  row_key: string;
  song_name: string;
  song_number_raw: string;
  status: MusicSourceImportStatus;
  message?: string;
  matched_track_id?: number;
  source_count: number;
  candidates?: MusicSourceImportCandidate[];
}

export interface MusicSourceImportPreviewResult {
  summary: {
    total: number;
    matched: number;
    needs_manual: number;
    not_found: number;
    invalid: number;
  };
  items: MusicSourceImportItem[];
}

export interface MusicSourceImportCommitResult {
  summary: {
    total: number;
    imported: number;
    skipped: number;
    needs_manual: number;
    not_found: number;
    invalid: number;
    error: number;
  };
  items: MusicSourceImportItem[];
}

export type MusicSourceConflictMode = 'overwrite' | 'append' | 'skip';
export type MusicSourceExportScope = 'all' | 'by_game' | 'by_album';

export interface MusicSourceExportPayload {
  scope: MusicSourceExportScope;
  game_ids?: number[];
  album_ids?: number[];
}

interface ExportMusicSourcesResult {
  blob: Blob;
  fileName: string;
}

const DEFAULT_EXPORT_FILE_NAME = 'music-sources-export.json';

const parseDownloadFileName = (contentDisposition?: string, fallback = DEFAULT_EXPORT_FILE_NAME): string => {
  if (!contentDisposition) return fallback;

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]).replace(/(^"|"$)/g, '');
  }

  const plainMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  if (plainMatch?.[1]) {
    return plainMatch[1].trim();
  }

  return fallback;
};

const extractBlobErrorMessage = async (blob: Blob): Promise<string | null> => {
  try {
    const text = await blob.text();
    const parsed = JSON.parse(text) as { error?: { message?: string } };
    return parsed.error?.message || null;
  } catch {
    return null;
  }
};

export const musicSourceService = {
  async getCategories(gameId: number): Promise<MusicSourceCategory[]> {
    const response = await api.get<ApiResponse<{ categories: MusicSourceCategory[] }>>('/music-sources/categories', {
      params: { game_id: gameId },
    });
    if (response.data.success && response.data.data) return response.data.data.categories;
    throw new Error(response.data.error?.message || '加载分类失败');
  },

  async createCategory(payload: {
    game_id: number;
    name: string;
    description?: string | null;
    display_order?: number;
  }): Promise<MusicSourceCategory> {
    const response = await api.post<ApiResponse<{ category: MusicSourceCategory }>>('/music-sources/categories', payload);
    if (response.data.success && response.data.data) return response.data.data.category;
    throw new Error(response.data.error?.message || '创建分类失败');
  },

  async updateCategory(
    categoryId: number,
    payload: { name: string; description?: string | null; display_order?: number }
  ): Promise<MusicSourceCategory> {
    const response = await api.put<ApiResponse<{ category: MusicSourceCategory }>>(`/music-sources/categories/${categoryId}`, payload);
    if (response.data.success && response.data.data) return response.data.data.category;
    throw new Error(response.data.error?.message || '更新分类失败');
  },

  async deleteCategory(categoryId: number): Promise<void> {
    const response = await api.delete<ApiResponse<{ deleted_id: number }>>(`/music-sources/categories/${categoryId}`);
    if (response.data.success) return;
    throw new Error(response.data.error?.message || '删除分类失败');
  },

  async getNodes(gameId: number, categoryId: number, parentId?: number | null): Promise<MusicSourceNode[]> {
    const response = await api.get<ApiResponse<{ nodes: MusicSourceNode[] }>>('/music-sources/nodes', {
      params: {
        game_id: gameId,
        category_id: categoryId,
        parent_id: parentId,
      },
    });
    if (response.data.success && response.data.data) return response.data.data.nodes;
    throw new Error(response.data.error?.message || '加载路径节点失败');
  },

  async createNode(payload: {
    game_id: number;
    category_id: number;
    parent_id?: number | null;
    name: string;
    display_order?: number;
  }): Promise<MusicSourceNode> {
    const response = await api.post<ApiResponse<{ node: MusicSourceNode }>>('/music-sources/nodes', payload);
    if (response.data.success && response.data.data) return response.data.data.node;
    throw new Error(response.data.error?.message || '创建路径节点失败');
  },

  async updateNode(nodeId: number, payload: { name: string; display_order?: number }): Promise<MusicSourceNode> {
    const response = await api.put<ApiResponse<{ node: MusicSourceNode }>>(`/music-sources/nodes/${nodeId}`, payload);
    if (response.data.success && response.data.data) return response.data.data.node;
    throw new Error(response.data.error?.message || '更新路径节点失败');
  },

  async deleteNode(nodeId: number): Promise<void> {
    const response = await api.delete<ApiResponse<{ deleted_id: number }>>(`/music-sources/nodes/${nodeId}`);
    if (response.data.success) return;
    throw new Error(response.data.error?.message || '删除路径节点失败');
  },

  async previewImport(entries: MusicSourceImportEntry[]): Promise<MusicSourceImportPreviewResult> {
    const response = await api.post<ApiResponse<MusicSourceImportPreviewResult>>('/music-sources/import/preview', { entries });
    if (response.data.success && response.data.data) return response.data.data;
    throw new Error(response.data.error?.message || '音乐来源导入预览失败');
  },

  async commitImport(
    entries: MusicSourceImportEntry[],
    resolutions: Record<string, number>,
    conflictMode: MusicSourceConflictMode
  ): Promise<MusicSourceImportCommitResult> {
    const response = await api.post<ApiResponse<MusicSourceImportCommitResult>>('/music-sources/import/commit', {
      entries,
      resolutions,
      conflict_mode: conflictMode,
    });
    if (response.data.success && response.data.data) return response.data.data;
    throw new Error(response.data.error?.message || '音乐来源导入失败');
  },

  async exportMusicSources(payload: MusicSourceExportPayload): Promise<ExportMusicSourcesResult> {
    try {
      const response = await api.post('/music-sources/export', payload, { responseType: 'blob' });
      const fileName = parseDownloadFileName(
        response.headers['content-disposition'] as string | undefined,
        DEFAULT_EXPORT_FILE_NAME
      );
      return { blob: response.data as Blob, fileName };
    } catch (error: any) {
      if (error?.response?.data instanceof Blob) {
        const serverMessage = await extractBlobErrorMessage(error.response.data as Blob);
        throw new Error(serverMessage || '导出音乐来源失败');
      }
      throw new Error(error?.message || '导出音乐来源失败');
    }
  },
};

