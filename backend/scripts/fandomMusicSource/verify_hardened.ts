import * as fs from 'fs';
import * as path from 'path';
import { extractEntity, classifyDuring, extractPrompt } from './adapters/resolve';
import { parseOtherLanguages } from './fandomClient';
import { parseInfobox } from './adapters/parse';

const CACHE = path.resolve(__dirname, '.cache');
const ds = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'out/music-source-dataset.json'), 'utf8'));

// ---- pure offline cache reader (NO network) ----
const cacheByTitle = new Map<string, { title: string; wt: string; redirects: any[] }>();
function loadCache() {
  const files = fs.readdirSync(CACHE).filter((f) => f.endsWith('.json'));
  for (const f of files) {
    let d: any; try { d = JSON.parse(fs.readFileSync(path.join(CACHE, f), 'utf8')); } catch { continue; }
    const p = d?.parse; if (!p || !p.title) continue;
    cacheByTitle.set(p.title.toLowerCase(), { title: p.title, wt: p.wikitext?.['*'] || '', redirects: p.redirects || [] });
  }
}
function findCache(entity: string): { title: string; wt: string } | null {
  const e = entity.trim();
  const direct = cacheByTitle.get(e.toLowerCase());
  if (direct) return { title: direct.title, wt: direct.wt };
  // redirect
  for (const v of cacheByTitle.values()) {
    for (const r of v.redirects) if (r?.from && r.from.toLowerCase() === e.toLowerCase()) return { title: v.title, wt: v.wt };
  }
  // slash/space-insensitive exact match
  const norm = (s: string) => s.toLowerCase().replace(/[\s_/]+/g, ' ').trim();
  const en = norm(e);
  for (const v of cacheByTitle.values()) if (norm(v.title) === en && !isSoundtrack(v.title, v.wt)) return { title: v.title, wt: v.wt };
  // search fallback: first non-soundtrack title containing entity
  let fb: { title: string; wt: string } | null = null;
  for (const v of cacheByTitle.values()) {
    if (v.title.toLowerCase().includes(e.toLowerCase()) && !isSoundtrack(v.title, v.wt)) { if (!fb) fb = { title: v.title, wt: v.wt }; }
  }
  return fb;
}
function isSoundtrack(title: string, wt: string) { return /soundtrack/i.test(title) || /{{Soundtrack Infobox/i.test(wt); }
function readParentOf(title: string, wt: string): string | null {
  if (isSoundtrack(title, wt)) return null;
  const names = ['Mission Infobox', 'Location Infobox', 'Area Infobox', 'Zone Infobox', 'Mission', 'Location', 'Area', 'Zone'];
  let ib: any = null;
  for (const n of names) { ib = parseInfobox(wt, n); if (ib && Object.keys(ib).length) break; }
  if (ib) {
    for (const f of ['location', 'area', 'subarea', 'region', 'zone', 'world', 'planet', 'system']) {
      const v = ib[f]; if (!v) continue;
      const cleaned = v.replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1').replace(/\s*\((Location|Area|Region|Zone|Disambiguation|Mission)\)/gi, '').replace(/'''?/g, '').trim();
      if (cleaned && cleaned.toLowerCase() !== title.toLowerCase()) return cleaned;
    }
  }
  return null;
}
function stripDisambig(s: string) { return s.replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1').replace(/\s*\((Location|Area|Region|Zone|Disambiguation|Mission)\)/gi, '').replace(/'''?/g, '').replace(/\s+/g, ' ').trim(); }
function trSeg(seg: string): string {
  const c = findCache(seg);
  if (!c) return seg;
  const ol = parseOtherLanguages(c.wt);
  return ol.zhs || ol.zh || ol.zht || seg;
}

// ---- replay hardened resolveEntity offline ----
async function resolveOffline(raw: string) {
  const kind = classifyDuring(raw) as any;
  const entity = extractEntity(raw, kind);
  const prompt = extractPrompt(raw, kind);
  if (!entity) return { zh: [], note: 'empty', resolved: false };
  const chain: string[] = [];
  const visited = new Set<string>();
  let cur: string | null = entity;
  let depth = 0; let hasParent = false;
  while (cur && depth < 6) {
    const k = cur.toLowerCase();
    if (visited.has(k)) break;
    visited.add(k);
    chain.unshift(cur);
    const c = findCache(cur);
    if (!c) break;
    if (depth === 0 && isSoundtrack(c.title, c.wt)) return { zh: [], note: 'resolved to soundtrack -> rejected', resolved: false };
    const parent = readParentOf(c.title, c.wt);
    if (parent && depth === 0) hasParent = true;
    cur = parent; depth++;
  }
  const zh = chain.map(trSeg);
  const resolved = chain.length > 0;
  return { zh, note: resolved ? (hasParent ? '' : 'resolved to subject, no location parent') : 'no resolvable location', resolved };
}

// ---- main ----
const trackCn = new Set<string>();
const trackEn = new Set<string>();
for (const g of ['hsr', 'genshin'] as const) for (const t of (ds[g]?.tracks || [])) {
  if (t.trackTitle) trackCn.add(t.trackTitle);
  if (t.title_en) trackEn.add(t.title_en);
  if (t.pageTitle) trackEn.add(t.pageTitle);
}
async function main() {
  loadCache();
  const hsr = ds.hsr.tracks || [];
  let oldSong = 0, newSong = 0, newPending = 0, checked = 0;
  const samples: string[] = [];
  for (const e of hsr) {
    for (const loc of (e.locations || [])) {
      const raw = loc.raw || ''; if (!raw) continue;
      const before = loc.resolvedZhPath || [];
      const beforeSong = before.some((s: string) => trackCn.has(s));
      const after = await resolveOffline(raw);
      const kind = classifyDuring(raw) as any;
      // version-kind: its zh name legitimately equals the version theme song title -> NOT a misplant
      const afterSong = kind !== 'version' && (after.zh || []).some((s: string) => trackCn.has(s));
      checked++;
      if (beforeSong) oldSong++;
      if (afterSong) {
        newSong++;
        if (samples.length < 15) samples.push(`  ${e.trackTitle || e.pageTitle}: raw="${String(raw).slice(0,55)}" | OLD[${before.join('/')}] NEW[${after.zh.join('/')}]`);
      } else if (!after.resolved) newPending++;
    }
  }
  console.log('=== OFFLINE hardened replay (HSR, .cache only) ===');
  console.log('locations checked       :', checked);
  console.log('OLD song-title misplant :', oldSong);
  console.log('NEW song-title misplant :', newSong, newSong === 0 ? '  <- FIXED (0)' : '  <- still some');
  console.log('NEW -> pending/rejected :', newPending);
  if (samples.length) { console.log('\nremaining song hits:'); console.log(samples.join('\n')); }
}
main().catch((e) => { console.error(e); process.exit(1); });
