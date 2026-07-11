import type {
  Album,
  Artist,
  Playlist,
  Tag,
  Track,
} from '@/generated/api-types';

/**
 * Base API URL.
 *
 * In dev (`tauri dev`) and in the packaged binary the frontend runs inside a
 * Tauri WebView. There is no same-origin backend to proxy to, so we default to
 * an absolute URL pointing at the locally-running HoYoMusic backend.
 *
 * Override with the VITE_API_BASE env var (e.g. when the backend is on another
 * host/port) — see Desktop/.env.example.
 */
const BASE: string = import.meta.env.VITE_API_BASE ?? 'http://localhost:3000/api';

/** Resolve a backend cover path into an absolute, backend-served URL. */
export function fetchCoverUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//.test(path)) return path;
  return `${BASE}/public/covers/proxy?path=${encodeURIComponent(path)}`;
}

// ---------------------------------------------------------------------------
// Raw backend shapes (authoritative contract lives in backend/ — see CLAUDE.md).
// Every public response is wrapped in { success, data?, error? }.
// ---------------------------------------------------------------------------
interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface ArtistRef {
  id?: number | string | null;
  name?: string;
}

/**
 * Extract a display string for artists from the many shapes the backend uses:
 *  - `artists: [{ id, name }, ...]` (list/detail track rows)
 *  - `artist_name` / `artistName` (legacy flat string)
 */
function artistDisplay(r: Record<string, unknown>): string {
  const artists = r['artists'];
  if (Array.isArray(artists) && artists.length > 0) {
    return artists
      .map((a) => (a && typeof a === 'object' ? (a as ArtistRef).name : a))
      .filter(Boolean)
      .join(', ');
  }
  const flat = (r['artist_name'] as string) ?? (r['artistName'] as string);
  return flat ?? '';
}

function coverOf(r: Record<string, unknown>): string | undefined {
  return (r['cover_path'] as string | undefined) ??
    (r['album_cover'] as string | undefined) ??
    (r['coverUrl'] as string | undefined) ??
    (r['avatar'] as string | undefined);
}

// ---------------------------------------------------------------------------
// Mappers: backend row -> friendly frontend type
// ---------------------------------------------------------------------------
function toTrack(r: Record<string, unknown>): Track {
  const id = r['id'];
  const audio =
    (r['audio_url'] as string | undefined) ??
    `${BASE}/public/tracks/${id}/stream`;
  return {
    id: String(id),
    title: (r['title'] as string) ?? '',
    artistName: artistDisplay(r) || '未知艺术家',
    albumTitle: (r['album_title'] as string) ?? (r['albumTitle'] as string),
    coverUrl: fetchCoverUrl(coverOf(r)),
    durationSec: (r['duration'] as number) ?? 0,
    audioUrl: audio,
  };
}

function toAlbum(r: Record<string, unknown>): Album {
  return {
    id: String(r['id']),
    title: (r['title'] as string) ?? '',
    artistName:
      (r['artist_name'] as string) ??
      (r['game_name'] as string) ??
      (r['artistName'] as string),
    coverUrl: fetchCoverUrl(coverOf(r)),
    releaseDate: (r['release_date'] as string) ?? undefined,
    trackCount: (r['track_count'] as number) ?? undefined,
  };
}

/** Artist list rows (`/api/artists`) are keyed by name and have no id. */
function toArtistList(r: Record<string, unknown>): Artist {
  const name = (r['name'] as string) ?? '未知艺术家';
  return {
    id: name,
    name,
    coverUrl: fetchCoverUrl(coverOf(r)),
  };
}

/** Artist detail object (`/api/artists/:id` -> data.artist). */
function toArtistDetail(r: Record<string, unknown>): Artist {
  const name = (r['name'] as string) ?? '未知艺术家';
  return {
    id: name,
    name,
    bio: (r['bio'] as string) ?? undefined,
    coverUrl: fetchCoverUrl(coverOf(r)),
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
//
// Endpoints used here are either under /api/public/* (explicitly unauthenticated)
// or under /api/albums and /api/artists, whose GET routes carry no auth
// middleware. Playlists require a JWT, which the desktop app does not hold, so
// those calls degrade gracefully to empty results.
// ---------------------------------------------------------------------------

export interface HomeData {
  featuredTracks: Track[];
  recentAlbums: Album[];
  playlists: Playlist[];
}

export async function fetchHome(): Promise<HomeData> {
  const [tracks, albums, top] = await Promise.all([
    api.get<{ tracks: Record<string, unknown>[] }>('/public/tracks/random?count=12'),
    api.get<{ albums: Record<string, unknown>[] }>('/public/albums/random?count=12'),
    api.get<{ tracks: Record<string, unknown>[] }>('/public/top-tracks?limit=20'),
  ]);
  return {
    featuredTracks: (top?.tracks ?? tracks?.tracks ?? []).map(toTrack),
    recentAlbums: (albums?.albums ?? []).map(toAlbum),
    playlists: [],
  };
}

export interface FetchTracksOptions {
  page?: number;
  tag?: string;
  search?: string;
  limit?: number;
}

export async function fetchTracks(
  opts: FetchTracksOptions = {},
): Promise<Track[]> {
  const params = new URLSearchParams();
  if (opts.page != null) params.set('page', String(opts.page));
  if (opts.limit != null) params.set('limit', String(opts.limit));
  if (opts.tag) params.set('tag', opts.tag);
  if (opts.search) params.set('search', opts.search);
  const qs = params.toString();
  const data = await api.get<{ tracks: Record<string, unknown>[] }>(
    `/public/tracks${qs ? `?${qs}` : ''}`,
  );
  return data?.tracks?.map(toTrack) ?? [];
}

export async function fetchTrack(id: string): Promise<Track | undefined> {
  const data = await api.get<{ track: Record<string, unknown> }>(
    `/public/tracks/${id}`,
  );
  return data?.track ? toTrack(data.track) : undefined;
}

/** Returns the album plus its full track list (bundle from GET /api/albums/:id). */
export async function fetchAlbum(
  id: string,
): Promise<{ album: Album; tracks: Track[] } | undefined> {
  const data = await api.get<{
    album: Record<string, unknown>;
    tracks: Record<string, unknown>[];
    discs?: unknown[];
  }>(`/albums/${id}`);
  if (!data?.album) return undefined;
  return {
    album: toAlbum(data.album),
    tracks: (data.tracks ?? []).map(toTrack),
  };
}

export async function fetchAlbums(): Promise<Album[]> {
  const data = await api.get<{ albums: Record<string, unknown>[] }>('/albums');
  return data?.albums?.map(toAlbum) ?? [];
}

export async function fetchArtists(): Promise<Artist[]> {
  const data = await api.get<{ artists: Record<string, unknown>[] }>('/artists');
  return data?.artists?.map(toArtistList) ?? [];
}

/** Returns the artist plus its tracks and albums (bundle from GET /api/artists/:id). */
export async function fetchArtist(
  id: string,
): Promise<{ artist: Artist; tracks: Track[]; albums: Album[] } | undefined> {
  const data = await api.get<{
    artist: Record<string, unknown>;
    tracks: Record<string, unknown>[];
    albums: Record<string, unknown>[];
    games?: Record<string, unknown>[];
  }>(`/artists/${id}`);
  if (!data?.artist) return undefined;
  return {
    artist: toArtistDetail(data.artist),
    tracks: (data.tracks ?? []).map(toTrack),
    albums: (data.albums ?? []).map(toAlbum),
  };
}

/**
 * Playlists require authentication (JWT) which the desktop app does not hold.
 * These degrade to empty results so the UI shows a clear "no playlists" state
 * rather than crashing. Login for the desktop client is a future addition.
 */
export async function fetchPlaylists(): Promise<Playlist[]> {
  return [];
}

export async function fetchPlaylist(
  _id: string,
): Promise<Playlist | undefined> {
  return undefined;
}

export async function searchTracks(q: string): Promise<Track[]> {
  const params = new URLSearchParams({ search: q, limit: '50' });
  const data = await api.get<{ tracks: Record<string, unknown>[] }>(
    `/public/tracks?${params.toString()}`,
  );
  return data?.tracks?.map(toTrack) ?? [];
}

export type { Album, Artist, Playlist, Tag, Track };
