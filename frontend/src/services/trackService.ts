import api, { createApiClient, MEDIA_BASE_URL } from './api';
import { ApiResponse, PaginationMeta, Track, TrackMusicSourceItem } from '../types';
import { MUSIC_ICON_PLACEHOLDER } from '../utils/imageUtils';
import { parseDownloadFileName, extractBlobErrorMessage } from '../utils/download';
import { readFlacTagsBrowser } from '../utils/flacTagsBrowser';


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

interface ExportCatalogMetadataResult {
  blob: Blob;
  fileName: string;
}

const DEFAULT_TRACK_NOTES_EXPORT_FILE_NAME = 'track-notes-export.json';
const DEFAULT_CATALOG_METADATA_EXPORT_FILE_NAME = 'catalog-metadata-export.json';

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

  /** 扫描 FLAC 标签（浏览器本地读取，不上传文件） */
  async scanTags(
    files: File[],
    onProgress?: (pct: number, speed: string) => void,
  ): Promise<Array<{ filename: string; title: string; album: string; track_number: string }>> {
    const results: Array<{ filename: string; title: string; album: string; track_number: string }> = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const tags = await readFlacTagsBrowser(f);
      results.push({ filename: f.name, ...tags });
      // 进度：本地读极快，按文件数算百分比
      if (onProgress) {
        onProgress(Math.round(((i + 1) / files.length) * 100), '本地读取');
      }
      // 让出主线程避免 UI 卡顿
      await new Promise(r => setTimeout(r, 0));
    }
    return results;
  },

  /** 获取 OSS 预签名上传 URL */
  async getUploadToken(filename: string, gameId: number): Promise<{ uploadUrl: string; objectKey: string }> {
    const response = await api.post<ApiResponse<{ uploadUrl: string; objectKey: string }>>(
      '/tracks/upload-token',
      { filename, game_id: gameId }
    );
    if (response.data.success && response.data.data) return response.data.data;
    throw new Error(response.data.error?.message || '获取上传URL失败');
  },

  /** 提交 OSS 直传文件到数据库 */
  async commitUpload(params: {
    objectKey: string;
    gameId: number;
    title_override?: string;
    album_override?: string;
    track_number_override?: string;
  }): Promise<{ track: { id: number; title: string; file_path: string } }> {
    const response = await api.post<ApiResponse<{ track: { id: number; title: string; file_path: string } }>>(
      '/tracks/commit',
      {
        objectKey: params.objectKey,
        game_id: params.gameId,
        title_override: params.title_override || undefined,
        album_override: params.album_override || undefined,
        track_number_override: params.track_number_override || undefined,
      }
    );
    if (response.data.success && response.data.data) return response.data.data;
    throw new Error(response.data.error?.message || '提交失败');
  },

  async uploadTracks(
    files: File[],
    options?: {
      gameId?: number;
      metaOverrides?: Array<{ title?: string; album?: string }>;
      trackNumberOverride?: string;
    }
  ): Promise<any> {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('tracks', file);
    });

    if (options?.gameId !== undefined) {
      formData.append('game_id', String(options.gameId));
    }

    if (options?.trackNumberOverride) {
      formData.append('track_number_override_0', options.trackNumberOverride);
    }

    if (options?.metaOverrides) {
      options.metaOverrides.forEach((meta, idx) => {
        if (meta.title)  formData.append(`title_override_${idx}`,  meta.title);
        if (meta.album !== undefined && meta.album !== '') formData.append(`album_override_${idx}`, meta.album);
      });
    }

    const response = await api.post<ApiResponse<any>>(
      `/tracks/upload?auto_credits=false`,
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

  async exportCatalogMetadata(): Promise<ExportCatalogMetadataResult> {
    try {
      const response = await api.get('/tracks/metadata-export', { responseType: 'blob' });
      const fileName = parseDownloadFileName(
        response.headers['content-disposition'] as string | undefined,
        DEFAULT_CATALOG_METADATA_EXPORT_FILE_NAME
      );
      return { blob: response.data as Blob, fileName };
    } catch (error: any) {
      if (error?.response?.data instanceof Blob) {
        const serverMessage = await extractBlobErrorMessage(error.response.data as Blob);
        throw new Error(serverMessage || '导出元数据失败');
      }
      throw new Error(error?.message || '导出元数据失败');
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

  async getTracks(page = 1, limit = 20, search = '', filters: AdminTrackFilters = {}): Promise<{ tracks: Track[]; pagination: PaginationMeta }> {
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

    const response = await api.get<ApiResponse<{ tracks: Track[]; pagination: PaginationMeta }>>(
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
  async getTracksPublic(page = 1, limit = 20, search = ''): Promise<{ tracks: Track[]; pagination: PaginationMeta }> {
    const response = await publicApi.get<ApiResponse<{ tracks: Track[]; pagination: PaginationMeta }>>(
      `/public/tracks?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&sort_by=release_date&sort_dir=DESC`
    );
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error('获取曲目列表失败');
  },

  async searchTracksPublic(params: TrackSearchParams): Promise<{ tracks: Track[]; pagination: PaginationMeta }> {
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

    const response = await publicApi.get<ApiResponse<{ tracks: Track[]; pagination: PaginationMeta }>>(
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

  async getTrackMusicSourcesPublic(id: number): Promise<TrackMusicSourceItem[]> {
    const response = await publicApi.get<ApiResponse<{ items: TrackMusicSourceItem[] }>>(`/public/tracks/${id}/music-sources`);
    if (response.data.success && response.data.data) {
      return response.data.data.items;
    }
    throw new Error('获取音乐来源失败');
  },

  getStreamUrl(id: number): string {
    const token = localStorage.getItem('token');
    return `${MEDIA_BASE_URL}/tracks/${id}/stream?token=${token}`;
  },

  getStreamUrlPublic(id: number): string {
    return `${MEDIA_BASE_URL}/public/tracks/${id}/stream`;
  },

  getDownloadUrl(id: number): string {
    const token = localStorage.getItem('token');
    return `${MEDIA_BASE_URL}/tracks/${id}/download?token=${token}`;
  },

  getDownloadUrlPublic(id: number): string {
    return `${MEDIA_BASE_URL}/public/tracks/${id}/download`;
  },

  getCoverUrl(coverPath: string | null, thumb?: boolean): string {
    // 空封面：优先使用静态占位图，加载失败时回退到内联 SVG，避免 404
    if (!coverPath) return MUSIC_ICON_PLACEHOLDER;
    const backendOrigin = MEDIA_BASE_URL.replace('/api', '');
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

  async clearTrackNotes(id: number): Promise<void> {
    const response = await api.delete<ApiResponse<any>>(`/tracks/${id}/notes`);
    if (!response.data.success) {
      throw new Error(response.data.error?.message || '清空备注失败');
    }
  },

  async clearAllTrackNotes(): Promise<{ cleared_count: number }> {
    const response = await api.post<ApiResponse<{ cleared_count: number }>>('/tracks/notes/clear-all', {
      confirm: 'CLEAR_ALL_NOTES',
    });
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error?.message || '清空全库备注失败');
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

