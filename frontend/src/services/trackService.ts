import api, { createApiClient } from './api';
import { ApiResponse, Track } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || `${window.location.origin}/api`;

/**
 * 全局下载功能开关
 * false = 关闭所有下载（服务器维护期间）
 * true  = 正常开放下载
 */
export const DOWNLOAD_ENABLED = false;

const publicApi = createApiClient({ noCacheForAuthedGet: false });

export interface TrackSearchParams {
  search?: string;
  game_ids?: number[];
  // Historical param name kept for compatibility; backend applies this to track_credits.credit_value.
  artist?: string;
  year_from?: number;
  year_to?: number;
  duration_min?: number;  // seconds
  duration_max?: number;  // seconds
  tag_ids?: number[];     // 多 tag 筛选
  tag_logic?: 'AND' | 'OR'; // 多 tag 逻辑（默认 AND）
  sort_by?: 'created_at' | 'title' | 'duration' | 'release_date';
  sort_dir?: 'ASC' | 'DESC';
  page?: number;
  limit?: number;
}

export interface AdminTrackFilters {
  title?: string;
  album?: string;
  durationBucket?: 'short' | 'medium' | 'long';
  hasLyrics?: boolean;
  lyricsStatus?: 'none' | 'has' | 'instrumental';
}

export interface AdminTrackFilterOptions {
  titles: string[];
  albums: string[];
}

export interface DuplicatePrecheckItem {
  index: number;
  file: string;
  title: string;
  album: string | null;
  reason: 'DUPLICATE_IN_DB' | 'DUPLICATE_IN_BATCH';
  existing_tracks?: Array<{
    id: number;
    title: string;
    album_id: number | null;
    album_title: string | null;
    artists: string[];
  }>;
}

export interface SameAlbumDuplicateGroup {
  album_id: number | null;
  album_title: string;
  normalized_title: string;
  display_title: string;
  duplicate_count: number;
  tracks: Array<{
    id: number;
    title: string;
    album_id: number | null;
    album_title: string;
    artists: string[];
  }>;
}

export type TrackNotesImportStatus = 'matched' | 'needs_manual' | 'not_found' | 'invalid' | 'imported' | 'skipped' | 'error';

export interface TrackNotesImportEntry {
  row_key: string;
  song_name: string;
  song_number?: string | number | null;
  note_lines: string[];
}

export interface TrackNotesImportCandidate {
  track_id: number;
  title: string;
  track_number: number | null;
  album_title: string;
  artists: string;
}

export interface TrackNotesImportItem {
  row_key: string;
  song_name: string;
  song_number_raw: string;
  status: TrackNotesImportStatus;
  message?: string;
  matched_track_id?: number;
  note_lines_count: number;
  candidates?: TrackNotesImportCandidate[];
}

export interface TrackNotesImportPreviewResult {
  summary: {
    total: number;
    matched: number;
    needs_manual: number;
    not_found: number;
    invalid: number;
  };
  items: TrackNotesImportItem[];
}

export interface TrackNotesImportCommitResult {
  summary: {
    total: number;
    imported: number;
    skipped: number;
    needs_manual: number;
    not_found: number;
    invalid: number;
    error: number;
  };
  items: TrackNotesImportItem[];
}

export interface CatalogMetadataImportItem {
  entity_type: 'album' | 'track';
  uuid: string;
  status: 'updated' | 'not_found' | 'skipped';
  entity_id?: number;
  reason?: string;
}

export interface CatalogMetadataImportResult {
  summary: {
    albums_input: number;
    tracks_input: number;
    albums_updated: number;
    tracks_updated: number;
    albums_not_found: number;
    tracks_not_found: number;
    skipped: number;
  };
  albums_not_found_uuids: string[];
  tracks_not_found_uuids: string[];
  items: CatalogMetadataImportItem[];
  batch_uuid?: string | null;
  dry_run: boolean;
}

export interface CatalogMetadataImportPayload {
  sync_legacy_title?: boolean;
  albums?: Array<{ uuid: string; title?: string; title_cn?: string | null; title_en?: string | null }>;
  tracks?: Array<{ uuid: string; title?: string; title_cn?: string | null; title_en?: string | null }>;
}

interface ExportTrackNotesResult {
  blob: Blob;
  fileName: string;
}

const DEFAULT_TRACK_NOTES_EXPORT_FILE_NAME = 'track-notes-export.json';

const parseDownloadFileName = (contentDisposition?: string, fallback = DEFAULT_TRACK_NOTES_EXPORT_FILE_NAME): string => {
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

export const trackService = {
  // Random tracks for homepage recommendations
  async getRandomTracks(count = 10): Promise<Track[]> {
    const response = await publicApi.get<ApiResponse<{ tracks: Track[] }>>(
      `/public/tracks/random?count=${count}`
    );
    if (response.data.success && response.data.data) {
      return response.data.data.tracks;
    }
    throw new Error('Failed to fetch random tracks');
  },

  // Admin APIs (需要认证)
  async uploadTracks(
    files: File[],
    options?: {
      autoCredits?: boolean;
      metaOverrides?: Array<{ title?: string; album?: string }>;
      // 前端编辑后的 credits，与 files 一一对应；若传入则覆盖后端自动解析
      creditsOverrides?: Array<Array<{ key: string; value: string }> | null>;
    }
  ): Promise<any> {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('tracks', file);
    });

    // auto_credits via URL query（绕开 multipart body 字段顺序问题）
    const autoCreditsVal = options?.autoCredits === false ? 'false' : 'true';

    if (options?.metaOverrides) {
      options.metaOverrides.forEach((meta, idx) => {
        if (meta.title)  formData.append(`title_override_${idx}`,  meta.title);
        if (meta.album !== undefined) formData.append(`album_override_${idx}`, meta.album);
      });
    }

    // 传入编辑后的 credits（JSON 序列化）
    if (options?.creditsOverrides) {
      options.creditsOverrides.forEach((credits, idx) => {
        if (credits && credits.length > 0) {
          formData.append(`credits_override_${idx}`, JSON.stringify(credits));
        }
      });
    }

    const response = await api.post<ApiResponse<any>>(
      `/tracks/upload?auto_credits=${autoCreditsVal}`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );

    if (response.data.success) {
      return response.data.data;
    }
    throw new Error(response.data.error?.message || '上传失败');
  },

  async previewCredits(files: File[]): Promise<Array<{ filename: string; credits: Array<{ key: string; value: string }> }>> {
    const formData = new FormData();
    files.forEach(f => formData.append('tracks', f));
    const response = await api.post<ApiResponse<{ results: Array<{ filename: string; credits: Array<{ key: string; value: string }> }> }>>(
      '/tracks/preview-credits',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    if (response.data.success && response.data.data) return response.data.data.results;
    throw new Error(response.data.error?.message || '预览失败');
  },

  async previewTrackNotesImport(entries: TrackNotesImportEntry[]): Promise<TrackNotesImportPreviewResult> {
    const response = await api.post<ApiResponse<TrackNotesImportPreviewResult>>('/tracks/notes-import/preview', { entries });
    if (response.data.success && response.data.data) return response.data.data;
    throw new Error(response.data.error?.message || '备注导入预览失败');
  },

  async commitTrackNotesImport(
    entries: TrackNotesImportEntry[],
    resolutions: Record<string, number>,
    conflictMode: 'overwrite' | 'append' | 'skip'
  ): Promise<TrackNotesImportCommitResult> {
    const response = await api.post<ApiResponse<TrackNotesImportCommitResult>>('/tracks/notes-import/commit', {
      entries,
      resolutions,
      conflict_mode: conflictMode,
    });
    if (response.data.success && response.data.data) return response.data.data;
    throw new Error(response.data.error?.message || '备注导入失败');
  },

  async searchTrackNotesImportCandidates(keyword: string, limit = 30): Promise<TrackNotesImportCandidate[]> {
    const normalizedKeyword = keyword.trim();
    if (!normalizedKeyword) return [];

    const response = await api.get<ApiResponse<{ candidates: TrackNotesImportCandidate[] }>>('/tracks/notes-import/candidates', {
      params: { keyword: normalizedKeyword, limit },
    });
    if (response.data.success && response.data.data) return response.data.data.candidates;
    throw new Error(response.data.error?.message || '候选曲目搜索失败');
  },

  async exportAllTrackNotes(): Promise<ExportTrackNotesResult> {
    try {
      const response = await api.get('/tracks/notes-export', { responseType: 'blob' });
      const fileName = parseDownloadFileName(
        response.headers['content-disposition'] as string | undefined,
        DEFAULT_TRACK_NOTES_EXPORT_FILE_NAME
      );
      return { blob: response.data as Blob, fileName };
    } catch (error: any) {
      if (error?.response?.data instanceof Blob) {
        const serverMessage = await extractBlobErrorMessage(error.response.data as Blob);
        throw new Error(serverMessage || '导出备注失败');
      }
      throw new Error(error?.message || '导出备注失败');
    }
  },

  async precheckDuplicateTracks(items: Array<{ index: number; file: string; title: string }>): Promise<DuplicatePrecheckItem[]> {
    const response = await api.post<ApiResponse<{ duplicates: DuplicatePrecheckItem[] }>>('/tracks/precheck-duplicates', { items });

    if (response.data.success && response.data.data) {
      return response.data.data.duplicates;
    }
    throw new Error(response.data.error?.message || '重名检查失败');
  },

  async getSameAlbumDuplicateTracks(): Promise<SameAlbumDuplicateGroup[]> {
    const response = await api.get<ApiResponse<{ groups: SameAlbumDuplicateGroup[] }>>('/tracks/duplicates/same-album-title');
    if (response.data.success && response.data.data) {
      return response.data.data.groups;
    }
    throw new Error(response.data.error?.message || '重复检查失败');
  },

  async getTracks(page = 1, limit = 20, search = '', filters: AdminTrackFilters = {}): Promise<{ tracks: Track[]; pagination: any }> {
    const query = new URLSearchParams();
    query.set('page', String(page));
    query.set('limit', String(limit));
    query.set('search', search);
    query.set('sort_by', 'release_date');
    query.set('sort_dir', 'DESC');

    if (filters.title) query.set('title_exact', filters.title);
    if (filters.album) query.set('album_exact', filters.album);
    if (filters.durationBucket) query.set('duration_bucket', filters.durationBucket);
    if (filters.lyricsStatus) {
      query.set('lyrics_status', filters.lyricsStatus);
    } else if (typeof filters.hasLyrics === 'boolean') {
      query.set('has_lyrics', String(filters.hasLyrics));
    }

    const response = await api.get<ApiResponse<{ tracks: Track[]; pagination: any }>>(
      `/tracks?${query.toString()}`
    );
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('获取曲目列表失败');
  },

  async getTrackFilterOptions(): Promise<AdminTrackFilterOptions> {
    const response = await api.get<ApiResponse<AdminTrackFilterOptions>>('/tracks/filter-options');
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('获取筛选候选失败');
  },

  // Public APIs (无需认证)
  async getTracksPublic(page = 1, limit = 20, search = ''): Promise<{ tracks: Track[]; pagination: any }> {
    const response = await publicApi.get<ApiResponse<{ tracks: Track[]; pagination: any }>>(
      `/public/tracks?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&sort_by=release_date&sort_dir=DESC`
    );
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('获取曲目列表失败');
  },

  async searchTracksPublic(params: TrackSearchParams): Promise<{ tracks: Track[]; pagination: any }> {
    const query = new URLSearchParams();
    if (params.search)                        query.set('search',          params.search);
    if (params.game_ids?.length)              query.set('game_ids',        params.game_ids.join(','));
    if (params.artist)                        query.set('artist',          params.artist);
    if (params.year_from       != null)       query.set('year_from',        String(params.year_from));
    if (params.year_to         != null)       query.set('year_to',          String(params.year_to));
    if (params.duration_min    != null)       query.set('duration_min',     String(params.duration_min));
    if (params.duration_max    != null)       query.set('duration_max',     String(params.duration_max));
    if (params.tag_ids?.length)               query.set('tag_ids',          params.tag_ids.join(','));
    if (params.tag_logic)                     query.set('tag_logic',        params.tag_logic);
    if (params.sort_by)                       query.set('sort_by',          params.sort_by);
    if (params.sort_dir)                      query.set('sort_dir',         params.sort_dir);
    query.set('page',  String(params.page  ?? 1));
    query.set('limit', String(params.limit ?? 20));

    const response = await publicApi.get<ApiResponse<{ tracks: Track[]; pagination: any }>>(
      `/public/tracks?${query.toString()}`
    );
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('搜索失败');
  },

  async getTrackById(id: number): Promise<Track> {
    const response = await api.get<ApiResponse<{ track: Track }>>(`/tracks/${id}`);
    if (response.data.success && response.data.data) {
      return response.data.data.track;
    }
    throw new Error('获取曲目详情失败');
  },

  /** Record a play event (fire-and-forget) */
  recordPlay(trackId: number, payload?: { playedSeconds?: number; trackDurationSeconds?: number | null; sessionKey?: string }): void {
    publicApi.post(`/public/tracks/${trackId}/play`, {
      played_seconds: payload?.playedSeconds ?? 0,
      track_duration_seconds: payload?.trackDurationSeconds ?? null,
      session_key: payload?.sessionKey ?? null,
    }).catch(() => {});
  },

  /** Get top played tracks */
  async getTopTracks(limit = 20): Promise<Track[]> {
    const response = await publicApi.get<ApiResponse<{ tracks: Track[] }>>(`/public/top-tracks?limit=${limit}`);
    if (response.data.success && response.data.data) return response.data.data.tracks;
    return [];
  },

  async getTrackByIdPublic(id: number): Promise<Track> {
    const response = await publicApi.get<ApiResponse<{ track: Track }>>(`/public/tracks/${id}`);
    if (response.data.success && response.data.data) {
      return response.data.data.track;
    }
    throw new Error('获取曲目详情失败');
  },

  getStreamUrl(id: number): string {
    const token = localStorage.getItem('token');
    return `${API_BASE_URL}/tracks/${id}/stream?token=${token}`;
  },

  getStreamUrlPublic(id: number): string {
    return `${API_BASE_URL}/public/tracks/${id}/stream`;
  },

  getDownloadUrl(id: number): string {
    const token = localStorage.getItem('token');
    return `${API_BASE_URL}/tracks/${id}/download?token=${token}`;
  },

  getDownloadUrlPublic(id: number): string {
    return `${API_BASE_URL}/public/tracks/${id}/download`;
  },

  getCoverUrl(coverPath: string | null, thumb?: boolean): string {
    if (!coverPath) return '/placeholder-cover.jpg';
    const backendOrigin = API_BASE_URL.replace('/api', '');
    const sizeParam = thumb ? '&size=thumb' : '';
    // OSS / 外部存储：cover_path 是完整 http(s) URL，通过服务器代理中转，避免前端直连 OSS
    if (coverPath.startsWith('http://') || coverPath.startsWith('https://')) {
      return `${backendOrigin}/api/public/covers/proxy?path=${encodeURIComponent(coverPath)}${sizeParam}`;
    }
    // 前端 public 目录下的静态资源（如游戏封面 /games/xxx.png），直接使用相对路径
    if (coverPath.startsWith('/') && !coverPath.startsWith('/uploads/')) {
      return coverPath;
    }
    // 后端本地上传文件: /uploads/... (new) or covers/... (legacy)
    const normalized = coverPath.startsWith('/') ? coverPath : `/uploads/${coverPath}`;
    if (thumb) {
      return `${backendOrigin}/api/public/covers/proxy?path=${encodeURIComponent(normalized)}${sizeParam}`;
    }
    return `${backendOrigin}${normalized}`;
  },

  // Update track metadata
  async updateTrack(
    id: number,
    data: { title: string; title_cn?: string | null; title_en?: string | null; artists: string[]; album_title?: string; release_date?: string; track_number?: number; notes?: string | null }
  ): Promise<void> {
    const response = await api.put<ApiResponse<any>>(`/tracks/${id}`, data);
    if (!response.data.success) {
      throw new Error(response.data.error?.message || '更新失败');
    }
  },

  // Delete track
  async deleteTrack(id: number): Promise<void> {
    const response = await api.delete<ApiResponse<any>>(`/tracks/${id}`);
    if (!response.data.success) {
      throw new Error(response.data.error?.message || '删除失败');
    }
  },

  // Bulk delete tracks
  async bulkDeleteTracks(ids: number[]): Promise<void> {
    const response = await api.delete<ApiResponse<any>>('/tracks/bulk', { data: { ids } });
    if (!response.data.success) {
      throw new Error(response.data.error?.message || '批量删除失败');
    }
  },

  // Bulk move tracks to album
  async bulkMoveTracksToAlbum(trackIds: number[], albumId: number | null): Promise<void> {
    const response = await api.post<ApiResponse<any>>('/tracks/bulk-move', { trackIds, albumId });
    if (!response.data.success) {
      throw new Error(response.data.error?.message || '批量移动失败');
    }
  },

  async previewCatalogMetadataImportByUuid(payload: CatalogMetadataImportPayload): Promise<CatalogMetadataImportResult> {
    const response = await api.post<ApiResponse<CatalogMetadataImportResult>>('/tracks/metadata-import/preview', payload);
    if (response.data.success && response.data.data) return response.data.data;
    throw new Error(response.data.error?.message || '导入预览失败');
  },

  async commitCatalogMetadataImportByUuid(payload: CatalogMetadataImportPayload): Promise<CatalogMetadataImportResult> {
    const response = await api.post<ApiResponse<CatalogMetadataImportResult>>('/tracks/metadata-import/commit', payload);
    if (response.data.success && response.data.data) return response.data.data;
    throw new Error(response.data.error?.message || '导入提交失败');
  },

  async rollbackCatalogMetadataBatch(batchUuid: string): Promise<{ batch_uuid: string; albums_reverted: number; tracks_reverted: number }> {
    const response = await api.post<ApiResponse<{ batch_uuid: string; albums_reverted: number; tracks_reverted: number }>>('/tracks/metadata-import/rollback', {
      batch_uuid: batchUuid,
    });
    if (response.data.success && response.data.data) return response.data.data;
    throw new Error(response.data.error?.message || '回滚失败');
  },

  // Upload track cover
  async uploadCover(id: number, file: File): Promise<{ track: Track; cover_path: string }> {
    const formData = new FormData();
    formData.append('cover', file);

    const response = await api.post<ApiResponse<{ track: Track; cover_path: string }>>(
      `/tracks/${id}/cover`,
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
    throw new Error(response.data.error?.message || '上传封面失败');
  },
};

