/**
 * HSR `during` resolver.
 *
 * HSR's `{{Soundtrack Infobox|during=...}}` is a single free-text field where
 * fandom editors crammed every kind of "where it plays" — real in-game
 * locations, boss fights, story beats, AND promotional trailers/PVs. To make
 * HSR's "scene location" browsable & consistent with Genshin's clean
 * `{{Soundtrack Usage|location=...}}` tree, we:
 *
 *   1. classify the `during` string into a semantic kind
 *      (location | boss | story | event | promo)
 *   2. strip the wrapper and extract the core *entity* name
 *      ("Dialogue scene in Dragon Mislay, Dreams Astray" -> "Dragon Mislay, Dreams Astray")
 *   3. resolve that entity against the fandom wiki: fetch its article, read its
 *      infobox region/planet/area (or its Categories), then walk UP the parent
 *      chain to build a full hierarchy  [game, planet, region, area, ...].
 *
 * Everything is cached on disk (via fandomClient.apiGet) and re-runnable.
 */
import { apiGet, getWikitext, parseOtherLanguages } from '../fandomClient';
import { parseInfobox } from './parse';
import { translatePrompt } from '../translator';
import { ParsedTrack, ParsedLocation } from './types';

export type DuringKind = 'location' | 'boss' | 'story' | 'event' | 'promo' | 'version';

/** Top-level HSR world containers we stop the upward walk at. */
const TOP_NODES = new Set([
  'honkai: star rail',
  'star rail',
  'jarilo-vi',
  'jarilo vi',
  'the xianzhou luofu',
  'xianzhou luofu',
  'penacony',
  'amphoreus',
  'herta\'s space station',
  'herta space station',
  'the universe',
]);

export function classifyDuring(s: string): DuringKind {
  const l = s.toLowerCase();
  if (/version\s*\d+(\.\d+)?\s*(trailer|update|preview)?/i.test(l) || /^\s*version\s*\d/i.test(l)) return 'version';
  if (/trailer|pv\b|show video|candidacy video|teaser|collab pv/.test(l)) return 'promo';
  if (/dialogue scene|animated short|cutscene/.test(l)) return 'story';
  if (/\(boss\)|\(phase|\(elite combat\)|\(combat\)|echo of war|swarm|reaver|decimator|anti-creator|skaracabaz|\bcombat\b/i.test(l))
    return 'boss';
  if (/event|wardance/.test(l)) return 'event';
  return 'location';
}

/** Strip the `during` wrapper and return the core entity name. */
export function extractEntity(s: string, kind: DuringKind): string {
  let e = s.trim();
  if (kind === 'version') {
    // "Version 3.1 Trailer: \"Light Slips the Gate...\"" -> "Version 3.1"
    const m = e.match(/version\s*\d+(\.\d+)?/i);
    e = m ? m[0].replace(/\s+/g, ' ') : e;
  } else if (kind === 'story') {
    e = e
      .replace(/^dialogue scene in\s*[:]?\s*/i, '')
      .replace(/^animated short\s*[:]?\s*/i, '')
      .replace(/^cutscene in\s*[:]?\s*/i, '')
      .replace(/^cutscene\s*[:]?\s*/i, '')
      // non-leading form: "Cyrene dialogue scene in: X" -> "Cyrene" (character is the subject)
      .replace(/^(.+?)\s+dialogue scene in\b.*$/i, '$1')
      .trim();
  } else if (kind === 'promo') {
    e = e
      .replace(/\s*(trailer|pv|teaser|show video|candidacy video).*$/i, '')
      .replace(/\s+character(\s+(trailer|pv|teaser))?$/i, '') // "The Herta Character" -> "The Herta" (resolves to 大黑塔)
      .replace(/^honkai:\s*star rail\s*[×x]\s*/i, '')
      .replace(/^honkai:\s*star rail\s*version\s*\d+(\.\d+)?\s*(trailer|update)?\s*:?/i, '')
      .replace(/version\s*\d+(\.\d+)?\s*(trailer|update|preview)?\s*[:—-].*$/i, (mm) => mm.match(/version\s*\d+(\.\d+)?/i)?.[0] || '') // "Version 3.1 Trailer — X" -> "Version 3.1"
      .trim();
  } else if (kind === 'boss') {
    e = e
      .replace(/^combat\s*:\s*/i, '') // "Combat: Argenti" -> "Argenti" (keep the boss name, prompt=Combat)
      .replace(/\s*\(phase[^)]*\)/i, '')
      .replace(/\s*\(elite combat\)/i, '')
      .replace(/\s*\(combat\)/i, '')
      .replace(/\s*\(boss\)/i, '')
      .replace(/\s*\(synthetic\)/i, '')
      .replace(/^echo of war:\s*/i, '')
      .replace(/^(event\s+)?/i, '')
      .replace(/:.*$/, '')
      .trim();
  } else if (kind === 'event') {
    e = e.replace(/^event\s*/i, '').replace(/\s*\(combat\)/i, '').trim();
  }
  // generic cleanup
  e = e
    .replace(/^"+/, '')
    .replace(/"+$/, '')
    .replace(/\s*<nowiki>\s*<\/nowiki>\s*/gi, '')
    // STRIP TEMPLATE WRAPPERS that hide the real entity name behind a
    // fandom `during` template, e.g. "Mission|Nemesis, Scorched by Golden
    // Blood|showChapter=0" -> "Nemesis, Scorched by Golden Blood". Without
    // this, findArticle searches the whole dirty string and fuzzy-matches a
    // soundtrack page, planting a song title as the location name.
    .replace(/\s*\|\s*(showChapter|showAct|showPart|showEvent|chapter|act|part|event)=[^\n|]*\s*/gi, '')
    .replace(/^[^|]*\|/, '') // leading "Mission|" / "Event|" etc.
    .replace(/\|[^|]*$/, '') // trailing "|junk"
    .replace(/\|/g, ' / ') // collapse any remaining pipes to a readable sep
    .replace(/\s+/g, ' ')
    .trim();
  return e;
}

/**
 * Extract the *prompt word* from a `during` string — the semantic hint that
 * fandom editors baked into the free-text field ("dialogue scene in", "Combat",
 * "Trailer", "Character", "Event", ...). These are RETAINED (never deleted);
 * translation is a separate, later step (see translator.translatePrompt).
 */
export function extractPrompt(s: string, kind: DuringKind): string {
  const l = s;
  if (kind === 'story') {
    const m = l.match(/\b(dialogue scene in|animated short|cutscene in|cutscene)\b/i);
    return m ? m[1] : '';
  }
  if (kind === 'promo') {
    const m = l.match(/\b(trailer|pv|teaser|show video|candidacy video|character)\b/i);
    return m ? m[1] : '';
  }
  if (kind === 'boss') {
    if (/\b(combat|boss|elite combat|echo of war)\b/i.test(l) || /\(combat\)|\(boss\)|combat:/i.test(l)) return 'Combat';
    return '';
  }
  if (kind === 'event') {
    if (/wardance/i.test(l)) return 'Wardance';
    return 'Event';
  }
  return '';
}

export interface ResolvedEntity {
  entity: string;
  kind: DuringKind | 'version';
  /** Full hierarchy from root down to the entity, English. */
  enPath: string[];
  /** Same path, translated to zh where available (falls back to English). */
  zhPath: string[];
  resolved: boolean;
  /** Found at least one parent location (i.e. this sits inside the scene tree). */
  hasParent: boolean;
  /** How it was resolved, for the report. */
  method: string;
  note?: string;
  /** Semantic prompt word retained from the raw `during` (never deleted). */
  prompt?: string;
  /** Translation of `prompt` (dictionary method; swappable). */
  promptZh?: string;
}

/**
 * Soundtrack pages are NEVER valid scene-location entities. If a search
 * fallback resolves an entity to a soundtrack page, that means the fuzzy
 * search mis-matched (e.g. a dirty `during` template) — reject it so the
 * caller falls back to `pending` instead of planting a song title as a
 * location name.
 */
function isSoundtrackPage(title: string, wt?: string): boolean {
  if (/soundtrack/i.test(title)) return true;
  if (wt && /{{Soundtrack Infobox/i.test(wt)) return true;
  return false;
}

/** Find the article title for an entity (direct, then search fallback). */
async function findArticle(wiki: string, entity: string): Promise<string | null> {
  // 1. direct
  const direct = await apiGet(wiki, { action: 'parse', page: entity, prop: 'wikitext', redirects: '1' }, true);
  if (direct?.parse?.title) {
    const wt: string = direct.parse.wikitext?.['*'] || '';
    if (!isSoundtrackPage(direct.parse.title, wt)) return direct.parse.title;
    // direct hit IS a soundtrack page -> this entity name is actually a song; reject
    return null;
  }
  // 2. search (prefer exact / non-soundtrack matches; NEVER a soundtrack page
  //    unless that is the ONLY hit — fuzzy search otherwise plants song titles
  //    as location names, e.g. "Version 2.7" -> "...Soundtrack" page)
  const search = await apiGet(wiki, { action: 'query', list: 'search', srsearch: entity, srlimit: '5' }, true);
  const hits: { title: string; snippet?: string }[] = (search?.query?.search || []).map((h: any) => ({ title: h.title, snippet: h.snippet }));
  const norm = (s: string) => s.toLowerCase().replace(/[\s_/]+/g, ' ').replace(/\s+version\s*/g, ' ').trim();
  const exact = norm(entity);
  let fallback: string | null = null;
  for (const h of hits) {
    if (isSoundtrackPage(h.title)) continue; // skip soundtrack pages entirely
    if (norm(h.title) === exact) return h.title; // exact (slash/space-insensitive)
    if (!fallback) fallback = h.title;
  }
  if (fallback) return fallback;
  // only soundtrack hits existed
  return null;
}

/** Read the parent location name from an article's infobox / categories. */
function readParent(wt: string, title: string): string | null {
  if (isSoundtrackPage(title, wt)) return null; // never walk up into a song page
  const names = ['Mission Infobox', 'Location Infobox', 'Area Infobox', 'Zone Infobox', 'Mission', 'Location', 'Area', 'Zone'];
  let ib: Record<string, string> | null = null;
  for (const n of names) {
    ib = parseInfobox(wt, n);
    if (ib && Object.keys(ib).length) break;
  }
  if (ib) {
    // most-specific field first
    const priority = ['location', 'area', 'subarea', 'region', 'zone', 'world', 'planet', 'system'];
    for (const f of priority) {
      const v = ib[f];
      if (!v) continue;
      const cleaned = stripDisambig(v);
      if (cleaned && cleaned.toLowerCase() !== title.toLowerCase()) return cleaned;
    }
  }
  // categories like "Category:Penacony Locations" -> parent = "Penacony"
  const catMatch = wt.match(/\{\{\s*[Cc]ategory\s*:\s*([^|}\n]+?)\s*(Locations|Area|Zone)s?\s*\}\}/);
  if (catMatch) return catMatch[1].trim();
  return null;
}

function stripDisambig(s: string): string {
  return s
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1') // [[X]] or [[X|Y]] -> X/Y
    .replace(/\s*\((?:Location|Area|Region|Zone|Disambiguation|Mission)\)/gi, '')
    .replace(/'''?/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Translate a single segment by fetching its article's Other Languages. */
async function translateSegment(wiki: string, seg: string): Promise<string> {
  try {
    const title = await findArticle(wiki, seg);
    if (!title) return seg;
    const wt = await getWikitext(wiki, title);
    const ol = parseOtherLanguages(wt);
    const zh = ol.zhs || ol.zh || ol.zht;
    return zh && zh.trim() ? zh.trim() : seg;
  } catch {
    return seg;
  }
}

/**
 * Resolve an entity to its full hierarchy. Best-effort: walks up the parent
 * chain as far as the wiki data allows, stopping at top-level world nodes or
 * after `maxDepth` hops to avoid loops.
 */
export async function resolveEntity(
  wiki: string,
  rawDuring: string
): Promise<ResolvedEntity> {
  const kind = classifyDuring(rawDuring);
  const entity = extractEntity(rawDuring, kind);
  const prompt = extractPrompt(rawDuring, kind);
  if (!entity) {
    return { entity: '', kind, enPath: [], zhPath: [], resolved: false, hasParent: false, method: 'empty', note: 'empty entity', prompt, promptZh: translatePrompt(prompt) };
  }

  const chain: string[] = [];
  const visited = new Set<string>();
  let current: string | null = entity;
  let depth = 0;
  let method = 'entity';
  let hasParent = false;

  while (current && depth < 6) {
    const key = current.toLowerCase();
    if (visited.has(key)) break;
    visited.add(key);
    if (TOP_NODES.has(key)) {
      chain.unshift(current);
      break;
    }
    chain.unshift(current);
    const title = await findArticle(wiki, current);
    if (!title) {
      method = depth === 0 ? 'no-article' : 'parent-no-article';
      break;
    }
    const wt = await getWikitext(wiki, title);
    const parent = readParent(wt, current);
    if (parent && depth === 0) hasParent = true;
    current = parent;
    depth++;
    method = depth === 1 ? 'entity' : 'walk-up';
  }

  const resolved = chain.length > 0 && method !== 'no-article';
  // translate each segment
  const zhPath: string[] = [];
  for (const seg of chain) zhPath.push(await translateSegment(wiki, seg));

  return {
    entity,
    kind,
    enPath: chain,
    zhPath,
    resolved,
    hasParent,
    method,
    note: resolved ? (hasParent ? undefined : 'resolved to subject, no location parent') : 'no resolvable location in wiki',
    prompt,
    promptZh: translatePrompt(prompt),
  };
}

/**
 * Attach resolution results to a list of parsed tracks (mutates in place).
 * Used by run.ts for the HSR game (the `during` field is the dirty one).
 */
export async function resolveTrackLocations(tracks: ParsedTrack[]): Promise<ParsedTrack[]> {
  const wiki = tracks.length && tracks[0].wiki === 'hsr' ? 'honkai-star-rail' : 'genshin-impact';
  for (const t of tracks) {
    const newLocs: ParsedLocation[] = [];
    for (const loc of t.locations || []) {
      const r = await resolveEntity(wiki, loc.raw || '');
      newLocs.push({
        ...loc,
        kind: r.kind,
        entity: r.entity,
        resolvedPath: r.enPath,
        resolvedZhPath: r.zhPath,
        resolved: r.resolved,
        hasParent: r.hasParent,
        method: r.method,
        note: r.note,
        prompt: r.prompt,
        promptZh: r.promptZh,
      });
    }
    t.locations = newLocs;
  }
  return tracks;
}
