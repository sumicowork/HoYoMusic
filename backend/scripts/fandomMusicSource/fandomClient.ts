/**
 * Fandom MediaWiki API client.
 *
 * Why api.php and not the article HTML: the fandom sites sit behind Cloudflare,
 * which returns 403 ("Just a moment...") for ordinary article pages. The
 * MediaWiki API (api.php) is NOT behind that challenge and answers HTTP 200,
 * so we crawl through it. This is the only reliable path from this environment.
 *
 * - Rate limited (~1 request / 450ms) to be a good citizen.
 * - Disk-cached under .cache/ so re-runs are fast and offline-friendly.
 * - `parseOtherLanguages` extracts the `{{Other Languages|zhs=|zht=|ja=|ko=}}`
 *   block — the #1 authority for translated proper nouns (user-confirmed).
 */
import fs from 'fs';
import path from 'path';

const CACHE_DIR = path.join(__dirname, '.cache');
const RATE_MS = 450;

let OFFLINE = false;
/** When true, apiGet never hits the network — cache misses return null. Used by offline re-parse. */
export function setOffline(v: boolean): void {
  OFFLINE = v;
}

let lastCall = 0;
async function throttle(): Promise<void> {
  const now = Date.now();
  const wait = RATE_MS - (now - lastCall);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
}

function cacheFile(key: string): string {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const safe = key.replace(/[^a-z0-9_.-]/gi, '_').slice(0, 180);
  return path.join(CACHE_DIR, safe + '.json');
}

export async function apiGet(
  wiki: string,
  params: Record<string, string>,
  useCache = true
): Promise<any> {
  const qs = new URLSearchParams({ ...params, format: 'json' }).toString();
  const url = `https://${wiki}.fandom.com/api.php?${qs}`;
  const key = `${wiki}__${JSON.stringify(params)}`;
  if (useCache) {
    const cp = cacheFile(key);
    if (fs.existsSync(cp)) return JSON.parse(fs.readFileSync(cp, 'utf8'));
  }
  if (OFFLINE) return null; // cache-only: never hit the network on a miss
  await throttle();
  const res = await fetch(url, {
    headers: { 'User-Agent': 'HoYoMusic-Rebuild/1.0 (research; +https://github.com/)' },
  });
  if (!res.ok) throw new Error(`Fandom API ${res.status} for ${url}`);
  const data = await res.json();
  if (useCache) fs.writeFileSync(cacheFile(key), JSON.stringify(data));
  return data;
}

export async function getWikitext(wiki: string, page: string): Promise<string> {
  const d = await apiGet(wiki, { action: 'parse', page, prop: 'wikitext', redirects: '1' });
  return d?.parse?.wikitext?.['*'] || '';
}

export async function getCategoryMembers(
  wiki: string,
  category: string,
  limit = 5000
): Promise<string[]> {
  const out: string[] = [];
  let cmcontinue: string | undefined;
  let calls = 0;
  do {
    const params: Record<string, string> = {
      action: 'query',
      list: 'categorymembers',
      cmtitle: category,
      cmlimit: '500',
    };
    if (cmcontinue) params.cmcontinue = cmcontinue;
    const d = await apiGet(wiki, params);
    const members = d?.query?.categorymembers || [];
    for (const m of members) out.push(m.title);
    cmcontinue = d?.continue?.cmcontinue;
    calls++;
  } while (cmcontinue && out.length < limit && calls < 200);
  return out;
}

/** List EVERY page in a namespace (default mainspace, ns=0) via list=allpages,
 *  paginated with apcontinue. This is the seed-free "full crawl" path: it does
 *  NOT rely on curated root categories, so it covers every proper-noun entity
 *  fandom documents — including ones outside our 16 hand-picked category trees.
 *  `limit` caps the result (0 = unlimited). */
export async function getAllPages(
  wiki: string,
  ns = 0,
  limit = 0,
): Promise<string[]> {
  const out: string[] = [];
  let apcontinue: string | undefined;
  let calls = 0;
  do {
    const params: Record<string, string> = {
      action: 'query',
      list: 'allpages',
      apnamespace: String(ns),
      aplimit: '500',
    };
    if (apcontinue) params.apcontinue = apcontinue;
    const d = await apiGet(wiki, params);
    const pages = d?.query?.allpages || [];
    for (const p of pages) out.push(p.title);
    apcontinue = d?.continue?.apcontinue;
    calls++;
  } while (apcontinue && (limit === 0 || out.length < limit) && calls < 200000);
  return out;
}

/** Extract the `{{Other Languages|...}}` block as a key→value map (lower-cased keys).
 *  Handles both plain keys (`zhs=`, `en=`) AND indexed variants (`1_zhs=`, `1_en=`)
 *  used on pages that carry multiple Other-Languages groups. Indexed keys are
 *  normalized by stripping the leading `<digits>_` prefix; the lowest index wins so
 *  the primary translation (group 1) is preferred. Values may themselves contain
 *  template pipes (e.g. `ja = {{Rubi|..|..}}`), so we split on the FIRST `=` per line
 *  rather than on `|`. */
export function parseOtherLanguages(wt: string): Record<string, string> {
  const m = wt.match(/\{\{\s*Other Languages\s*\|([\s\S]*?)\n\}\}/) ||
            wt.match(/\{\{\s*Other Languages\s*\|([\s\S]*?)\}\}/);
  if (!m) return {};
  const body = m[1];
  const out: Record<string, string> = {};
  const seenIndex: Record<string, number> = {};
  for (const rawLine of body.split('\n')) {
    const line = rawLine.replace(/^\s*\|?\s*/, ''); // strip leading pipe/space
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const rawKey = line.slice(0, eq).trim().toLowerCase();
    if (!/^(\d+_)?[a-z]+$/.test(rawKey)) continue; // only lang-code fields
    const val = stripRubi(line.slice(eq + 1).trim());
    if (!val) continue;
    // normalize indexed key `1_zhs` -> `zhs`, remember its index (default 0)
    const im = rawKey.match(/^(\d+)_([a-z]+)$/);
    const key = im ? im[2] : rawKey;
    const idx = im ? parseInt(im[1], 10) : 0;
    if (!(key in out) || idx < seenIndex[key]) {
      out[key] = val;
      seenIndex[key] = idx;
    }
  }
  return out;
}

/** Reduce `{{Rubi|二相楽園|にそうらくえん}}` to its base text `二相楽園`. */
function stripRubi(v: string): string {
  const m = v.match(/\{\{\s*Rubi\s*\|\s*([^|}]+)/i);
  return (m ? m[1] : v).replace(/\{\{[^}]*\}\}/g, '').replace(/[{}]/g, '').trim();
}
