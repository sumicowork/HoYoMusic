/**
 * staticDataService.ts
 * 静态模式下的数据读取层 — 从 /data/*.json 获取预生成的静态快照。
 * 仅在 VITE_STATIC_MODE=true 时被调用，动态模式完全不触及此文件。
 */
import Fuse from 'fuse.js';
import type { Track } from '../types';

// ────────────────────────────────────────────────────────────
// 内存缓存
// ────────────────────────────────────────────────────────────
const cache: Record<string, any> = {};

export interface FirstVisitModalConfig {
  enabled: boolean;
  title: string;
  content: string;
  min_stay_seconds: number;
  version: string;
}

export interface SiteComplianceConfig {
  enabled: boolean;
  icp_number: string;
  public_security_number: string;
}

interface SiteConfigSnapshot {
  first_visit_modal?: Partial<FirstVisitModalConfig>;
  compliance?: Partial<SiteComplianceConfig>;
}

const DEFAULT_FIRST_VISIT_MODAL_CONFIG: FirstVisitModalConfig = {
  enabled: false,
  title: '欢迎来到 HoYoMusic',
  content: '本站仅用于音乐欣赏与资料整理。请遵守相关法律法规。',
  min_stay_seconds: 5,
  version: '1',
};

const DEFAULT_SITE_COMPLIANCE_CONFIG: SiteComplianceConfig = {
  enabled: false,
  icp_number: '',
  public_security_number: '',
};

async function fetchJSON<T>(path: string): Promise<T> {
  if (cache[path]) return cache[path] as T;
  const resp = await fetch(path);
  if (!resp.ok) throw new Error(`Static fetch failed: ${path} (${resp.status})`);
  const data = await resp.json();
  cache[path] = data;
  return data as T;
}

// ────────────────────────────────────────────────────────────
// Games
// ────────────────────────────────────────────────────────────
export async function getGames() {
  return fetchJSON<any[]>('/data/games.json');
}

export async function getGameById(id: number) {
  return fetchJSON<any>(`/data/games/${id}.json`);
}

// ────────────────────────────────────────────────────────────
// Site Config
// ────────────────────────────────────────────────────────────
export async function getFirstVisitModalConfig(): Promise<FirstVisitModalConfig> {
  const snapshot = await fetchJSON<SiteConfigSnapshot>('/data/site-config.json');
  const raw = snapshot.first_visit_modal ?? {};
  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : DEFAULT_FIRST_VISIT_MODAL_CONFIG.enabled,
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title : DEFAULT_FIRST_VISIT_MODAL_CONFIG.title,
    content: typeof raw.content === 'string' && raw.content.trim() ? raw.content : DEFAULT_FIRST_VISIT_MODAL_CONFIG.content,
    min_stay_seconds: Number.isFinite(raw.min_stay_seconds)
      ? Math.max(5, Math.floor(raw.min_stay_seconds as number))
      : DEFAULT_FIRST_VISIT_MODAL_CONFIG.min_stay_seconds,
    version: typeof raw.version === 'string' && raw.version.trim() ? raw.version : DEFAULT_FIRST_VISIT_MODAL_CONFIG.version,
  };
}

export async function getSiteComplianceConfig(): Promise<SiteComplianceConfig> {
  const snapshot = await fetchJSON<SiteConfigSnapshot>('/data/site-config.json');
  const raw = snapshot.compliance ?? {};
  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : DEFAULT_SITE_COMPLIANCE_CONFIG.enabled,
    icp_number: typeof raw.icp_number === 'string' ? raw.icp_number.trim() : DEFAULT_SITE_COMPLIANCE_CONFIG.icp_number,
    public_security_number: typeof raw.public_security_number === 'string'
      ? raw.public_security_number.trim()
      : DEFAULT_SITE_COMPLIANCE_CONFIG.public_security_number,
  };
}

// ────────────────────────────────────────────────────────────
// Albums
// ────────────────────────────────────────────────────────────
export async function getAlbums(page = 1, limit = 100, search = '') {
  const all = await fetchJSON<any[]>('/data/albums.json');
  let filtered = all;
  if (search) {
    const s = search.toLowerCase();
    filtered = all.filter((a: any) => a.title.toLowerCase().includes(s));
  }
  const total = filtered.length;
  const start = (page - 1) * limit;
  const albums = filtered.slice(start, start + limit);
  return {
    albums,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getAlbumById(id: number) {
  return fetchJSON<any>(`/data/albums/${id}.json`);
}

// ────────────────────────────────────────────────────────────
// Tracks
// ────────────────────────────────────────────────────────────
let _allTracks: Track[] | null = null;
let _fuse: Fuse<Track> | null = null;

async function loadAllTracks(): Promise<Track[]> {
  if (_allTracks) return _allTracks;
  _allTracks = await fetchJSON<Track[]>('/data/tracks.json');
  return _allTracks;
}

function getFuse(tracks: Track[]): Fuse<Track> {
  if (_fuse) return _fuse;
  _fuse = new Fuse(tracks, {
    keys: [
      { name: 'title', weight: 3 },
      { name: 'album_title', weight: 2 },
      { name: 'artists.name', weight: 2 },
    ],
    threshold: 0.35,
    includeScore: false,
  });
  return _fuse;
}

export async function getTracksPublic(page = 1, limit = 20, search = '') {
  const all = await loadAllTracks();
  let filtered = all;
  if (search) {
    const fuse = getFuse(all);
    filtered = fuse.search(search).map((r) => r.item);
  }
  const total = filtered.length;
  const start = (page - 1) * limit;
  const tracks = filtered.slice(start, start + limit);
  return {
    tracks,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export interface StaticSearchParams {
  search?: string;
  sample_rate_min?: number;
  bit_depth?: number;
  year_from?: number;
  year_to?: number;
  duration_min?: number;
  duration_max?: number;
  tag_ids?: number[];
  tag_logic?: 'AND' | 'OR';
  sort_by?: string;
  sort_dir?: 'ASC' | 'DESC';
  page?: number;
  limit?: number;
}

export async function searchTracksPublic(params: StaticSearchParams) {
  let tracks = await loadAllTracks();

  // keyword search
  if (params.search) {
    const fuse = getFuse(tracks);
    tracks = fuse.search(params.search).map((r) => r.item);
  }

  // filters
  if (params.sample_rate_min != null) {
    tracks = tracks.filter((t) => (t.sample_rate ?? 0) >= params.sample_rate_min!);
  }
  if (params.bit_depth != null) {
    tracks = tracks.filter((t) => t.bit_depth === params.bit_depth);
  }
  if (params.year_from != null) {
    tracks = tracks.filter((t) => {
      const y = t.release_date ? new Date(t.release_date).getFullYear() : new Date(t.created_at).getFullYear();
      return y >= params.year_from!;
    });
  }
  if (params.year_to != null) {
    tracks = tracks.filter((t) => {
      const y = t.release_date ? new Date(t.release_date).getFullYear() : new Date(t.created_at).getFullYear();
      return y <= params.year_to!;
    });
  }
  if (params.duration_min != null) {
    tracks = tracks.filter((t) => (t.duration ?? 0) >= params.duration_min!);
  }
  if (params.duration_max != null) {
    tracks = tracks.filter((t) => (t.duration ?? Infinity) <= params.duration_max!);
  }

  // tag filtering
  if (params.tag_ids && params.tag_ids.length > 0) {
    const ids = new Set(params.tag_ids);
    if (params.tag_logic === 'OR') {
      tracks = tracks.filter((t) => (t.tags ?? []).some((tag) => ids.has(tag.id)));
    } else {
      tracks = tracks.filter((t) => {
        const trackTagIds = new Set((t.tags ?? []).map((tag) => tag.id));
        return params.tag_ids!.every((id) => trackTagIds.has(id));
      });
    }
  }

  // sort
  const sortBy = params.sort_by || 'created_at';
  const sortDir = params.sort_dir === 'ASC' ? 1 : -1;
  tracks = [...tracks].sort((a: any, b: any) => {
    const va = a[sortBy] ?? '';
    const vb = b[sortBy] ?? '';
    if (va < vb) return -1 * sortDir;
    if (va > vb) return 1 * sortDir;
    return 0;
  });

  const total = tracks.length;
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  const start = (page - 1) * limit;
  return {
    tracks: tracks.slice(start, start + limit),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getTrackByIdPublic(id: number): Promise<Track> {
  return fetchJSON<Track>(`/data/tracks/${id}.json`);
}

// ────────────────────────────────────────────────────────────
// Artists
// ────────────────────────────────────────────────────────────
export async function getArtists(page = 1, limit = 100, search = '') {
  const all = await fetchJSON<any[]>('/data/artists.json');
  let filtered = all;
  if (search) {
    const s = search.toLowerCase();
    filtered = all.filter((a: any) => a.name.toLowerCase().includes(s));
  }
  const total = filtered.length;
  const start = (page - 1) * limit;
  return {
    artists: filtered.slice(start, start + limit),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getArtistById(name: string) {
  return fetchJSON<any>(`/data/artists/${encodeURIComponent(name)}.json`);
}

// ────────────────────────────────────────────────────────────
// Tags
// ────────────────────────────────────────────────────────────
export async function getTags() {
  return fetchJSON<any[]>('/data/tags.json');
}

export async function getTagById(id: number) {
  return fetchJSON<any>(`/data/tags/${id}.json`);
}

export async function getTagGroups() {
  return fetchJSON<any[]>('/data/tag-groups.json');
}

export async function getTrackTags(trackId: number) {
  const track = await getTrackByIdPublic(trackId);
  return track.tags ?? [];
}

// ────────────────────────────────────────────────────────────
// Lyrics & Credits (内嵌在 track JSON 中)
// ────────────────────────────────────────────────────────────
export async function getLyrics(trackId: number): Promise<string | null> {
  try {
    const track = await getTrackByIdPublic(trackId);
    return track.lyrics ?? null;
  } catch {
    return null;
  }
}

export async function getCredits(trackId: number) {
  try {
    const track = await getTrackByIdPublic(trackId);
    return track.credits ?? [];
  } catch {
    return [];
  }
}

// ────────────────────────────────────────────────────────────
// Random Recommendations (static mode: shuffle from cached data)
// ────────────────────────────────────────────────────────────
function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export async function getRandomAlbums(count = 6): Promise<any[]> {
  const all = await fetchJSON<any[]>('/data/albums.json');
  return shuffleArray(all).slice(0, count);
}

export async function getRandomTracks(count = 10): Promise<Track[]> {
  const all = await loadAllTracks();
  return shuffleArray(all).slice(0, count);
}

// ────────────────────────────────────────────────────────────
// Cover URL (静态模式下已是相对路径)
// ────────────────────────────────────────────────────────────
export function getCoverUrl(coverPath: string | null): string {
  if (!coverPath) return '';
  // 已经是完整 URL（CDN）
  if (coverPath.startsWith('http://') || coverPath.startsWith('https://')) return coverPath;
  // 已经是 /data/covers/... 的相对路径
  return coverPath;
}

