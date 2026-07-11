/**
 * Frontend-friendly domain types for the HoYoMusic desktop client.
 *
 * These are the canonical shared contracts that the player store
 * (`@/store/playerStore`) and API client (`@/lib/api`) depend on. Field names
 * are normalized to camelCase / frontend conventions (e.g. `durationSec`,
 * `coverUrl`, `artistName`) and differ from the raw backend schema.
 *
 * The raw OpenAPI contract lives in `../openapi/openapi.json`. This file was
 * authored to match that contract (see CLAUDE.md: back-end API contracts are
 * authoritative). `openapi-typescript` can regenerate a raw, schema-exact
 * companion file if needed, but the friendly shapes below are the source of
 * truth for this client.
 */

export interface Track {
  id: string;
  title: string;
  artistName: string;
  albumTitle?: string;
  coverUrl?: string;
  durationSec: number;
  audioUrl: string;
}

export interface Album {
  id: string;
  title: string;
  artistName?: string;
  coverUrl?: string;
  releaseDate?: string;
  trackCount?: number;
}

export interface Artist {
  id: string;
  name: string;
  coverUrl?: string;
  bio?: string;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  coverUrl?: string;
  trackCount?: number;
  totalDuration?: number;
  tracks?: Track[];
}

export interface Tag {
  id: string;
  name: string;
  slug?: string;
}

export interface Lyric {
  id: string;
  trackId: string;
  startTimeSec: number;
  endTimeSec?: number;
  text: string;
  language?: string;
}
