import type {
  Album,
  Artist,
  Playlist,
  Tag,
  Track,
} from '@/generated/api-types';

/**
 * Base API URL. Defaults to the relative '/api' so the Vite dev-server proxy
 * (see vite.config.ts) forwards to the backend on http://localhost:3000.
 */
const BASE: string = import.meta.env.VITE_API_BASE ?? '/api';

/** Resolve a backend cover path into a proxied, absolute-ish URL. */
export function fetchCoverUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//.test(path)) return path;
  return `${BASE}/public/covers/proxy?path=${encodeURIComponent(path)}`;
}

// ---------------------------------------------------------------------------
// Raw backend shapes (authoritative contract lives in backend/ — see CLAUDE.md).
// The HoYoMusic API wraps every response in { success, data?, error? }.
// ---------------------------------------------------------------------------
interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface RawTrack {
  id: number | string;
  title: string;
  artist_name?: string;
  artistName?: string;
  album_id?: number;
  album_title?: string;
  albumTitle?: string;
  duration?: number;
  cover_path?: string | null;
  coverUrl?: string;
  audio_url?: string;
  file_path?: string;
}

interface RawAlbum {
  id: number | string;
  title: string;
  game_id?: number | null;
  game_name?: string;
  artist_name?: string;
  cover_path?: string | null;
  coverUrl?: string;
  release_date?: string | null;
  track_count?: number;
}

interface RawPlaylist {
  id: number | string;
  name: string;
  description?: string | null;
  track_count?: number;
  total_duration?: number;
  tracks?: RawTrack[];
}

// ---------------------------------------------------------------------------
// Mappers: backend -> friendly frontend types
// ---------------------------------------------------------------------------
function toTrack(r: RawTrack): Track {
  return {
    id: String(r.id),
    title: r.title ?? '',
    artistName: r.artist_name ?? r.artistName ?? '未知艺术家',
    albumTitle: r.album_title ?? r.albumTitle,
    coverUrl: fetchCoverUrl(r.cover_path ?? r.coverUrl),
    durationSec: r.duration ?? 0,
    audioUrl: r.audio_url ?? `${BASE}/public/tracks/${r.id}/stream`,
  };
}

function toAlbum(r: RawAlbum): Album {
  return {
    id: String(r.id),
    title: r.title ?? '',
    artistName: r.artist_name,
    coverUrl: fetchCoverUrl(r.cover_path ?? r.coverUrl),
    releaseDate: r.release_date ?? undefined,
    trackCount: r.track_count,
  };
}

function toPlaylist(r: RawPlaylist): Playlist {
  return {
    id: String(r.id),
    name: r.name ?? '',
    description: r.description ?? undefined,
    coverUrl: undefined,
    trackCount: r.track_count,
    totalDuration: r.total_duration,
    tracks: r.tracks?.map(toTrack),
  };
}

// ---------------------------------------------------------------------------
// `api` — the fetch wrapper used by all typed functions below.
// ---------------------------------------------------------------------------
export const api = {
  base: BASE,

  /** GET a JSON endpoint. Unwraps the { success, data } envelope. Resilient. */
  async get<T>(path: string, init?: RequestInit): Promise<T | undefined> {
    try {
      const res = await fetch(`${BASE}${path}`, {
        method: 'GET',
        headers: { Accept: 'application/json', ...(init?.headers ?? {}) },
        ...init,
      });
      if (!res.ok) return undefined;
      const json = (await res.json()) as ApiEnvelope<T> | T;
      if (
        json &&
        typeof json === 'object' &&
        'data' in json &&
        'success' in json
      ) {
        return (json as ApiEnvelope<T>).data;
      }
      return json as T;
    } catch {
      return undefined;
    }
  },

  /** POST a JSON body. Resilient. */
  async post<T>(path: string, body?: unknown): Promise<T | undefined> {
    try {
      const res = await fetch(`${BASE}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (!res.ok) return undefined;
      const json = (await res.json()) as ApiEnvelope<T> | T;
      if (
        json &&
        typeof json === 'object' &&
        'data' in json &&
        'success' in json
      ) {
        return (json as ApiEnvelope<T>).data;
      }
      return json as T;
    } catch {
      return undefined;
    }
  },
};

// ---------------------------------------------------------------------------
// Typed API functions (all async, resilient — return [] / undefined on error)
// ---------------------------------------------------------------------------

export interface HomeData {
  featuredTracks: Track[];
  recentAlbums: Album[];
  playlists: Playlist[];
}

export async function fetchHome(): Promise<HomeData> {
  const data = await api.get<{
    featuredTracks?: RawTrack[];
    recentAlbums?: RawAlbum[];
    playlists?: RawPlaylist[];
  }>('/home');
  return {
    featuredTracks: data?.featuredTracks?.map(toTrack) ?? [],
    recentAlbums: data?.recentAlbums?.map(toAlbum) ?? [],
    playlists: data?.playlists?.map(toPlaylist) ?? [],
  };
}

export interface FetchTracksOptions {
  page?: number;
  tag?: string;
  search?: string;
}

export async function fetchTracks(
  opts: FetchTracksOptions = {},
): Promise<Track[]> {
  const params = new URLSearchParams();
  if (opts.page != null) params.set('page', String(opts.page));
  if (opts.tag) params.set('tag', opts.tag);
  if (opts.search) params.set('search', opts.search);
  const qs = params.toString();
  const data = await api.get<RawTrack[]>(`/tracks${qs ? `?${qs}` : ''}`);
  return data?.map(toTrack) ?? [];
}

export async function fetchTrack(id: string): Promise<Track | undefined> {
  const data = await api.get<RawTrack>(`/tracks/${id}`);
  return data ? toTrack(data) : undefined;
}

export async function fetchAlbum(id: string): Promise<Album | undefined> {
  const data = await api.get<RawAlbum>(`/albums/${id}`);
  return data ? toAlbum(data) : undefined;
}

export async function fetchAlbums(): Promise<Album[]> {
  const data = await api.get<RawAlbum[]>('/albums');
  return data?.map(toAlbum) ?? [];
}

export async function fetchArtists(): Promise<Artist[]> {
  const data = await api.get<Artist[]>('/artists');
  return data ?? [];
}

export async function fetchArtist(id: string): Promise<Artist | undefined> {
  const data = await api.get<Artist>(`/artists/${id}`);
  return data;
}

export async function fetchPlaylists(): Promise<Playlist[]> {
  const data = await api.get<RawPlaylist[]>('/playlists');
  return data?.map(toPlaylist) ?? [];
}

export async function fetchPlaylist(id: string): Promise<Playlist | undefined> {
  const data = await api.get<RawPlaylist>(`/playlists/${id}`);
  return data ? toPlaylist(data) : undefined;
}

export async function searchTracks(q: string): Promise<Track[]> {
  const params = new URLSearchParams({ q });
  const data = await api.get<RawTrack[]>(`/search?${params.toString()}`);
  return data?.map(toTrack) ?? [];
}

export type { Album, Artist, Playlist, Tag, Track };
