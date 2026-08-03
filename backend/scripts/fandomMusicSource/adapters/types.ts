export interface ParsedLocation {
  enPath: string[];
  zhPath: string[];
  pending: boolean;
  raw: string;
  /** Which `Soundtrack Usage` dimension this came from (Genshin: location/quest/domain/teapot/...). */
  dimension?: string;
  /** HSR `during` resolution (see adapters/resolve.ts). */
  kind?: 'location' | 'boss' | 'story' | 'event' | 'promo' | 'version';
  entity?: string;
  /** Semantic prompt word kept from the raw `during` (e.g. "dialogue scene in", "Combat", "Trailer"). NOT deleted — retained for later translation. */
  prompt?: string;
  /** Translation of `prompt` (dictionary method; swappable for LLM later). */
  promptZh?: string;
  /** Resolved full hierarchy (root -> leaf), English. */
  resolvedPath?: string[];
  /** Same path translated to zh where available. */
  resolvedZhPath?: string[];
  resolved?: boolean;
  /** Found a parent location (sits inside the scene tree) vs only a subject. */
  hasParent?: boolean;
  method?: string;
  note?: string;
}

export interface ParsedCredit {
  role: string;
  name: string;
}

export interface ParsedTrack {
  wiki: 'genshin' | 'hsr';
  pageTitle: string;
  trackTitle: string;
  album?: string;
  disc?: string;
  number?: number;
  youtubeId?: string;
  spotifyId?: string;
  locations: ParsedLocation[];
  credits: ParsedCredit[];
  otherLanguages: Record<string, string>;
}

export type PageKind = 'track' | 'album' | 'skip';

export interface MusicSourceAdapter {
  wiki: string;
  categoryTitle: string;
  /** Optional second category to enumerate (e.g. albums live outside Category:Soundtracks). */
  albumCategoryTitle?: string;
  classify(wt: string, title: string): PageKind;
  parseTrack(wt: string, title: string): ParsedTrack;
}
