import * as fs from 'fs';
import * as path from 'path';
import { parseOtherLanguages } from './fandomClient';
import { parseInfobox } from './adapters/parse';
const CACHE = path.resolve(__dirname, '.cache');
const cacheByTitle = new Map<string, { title: string; wt: string; redirects: any[] }>();
for (const f of fs.readdirSync(CACHE).filter((x) => x.endsWith('.json'))) {
  let d: any; try { d = JSON.parse(fs.readFileSync(path.join(CACHE, f), 'utf8')); } catch { continue; }
  const p = d?.parse; if (!p || !p.title) continue;
  cacheByTitle.set(p.title.toLowerCase(), { title: p.title, wt: p.wikitext?.['*'] || '', redirects: p.redirects || [] });
}
function isSoundtrack(t: string, w: string) { return /soundtrack/i.test(t) || /{{Soundtrack Infobox/i.test(w); }
function findCache(entity: string): { title: string; wt: string } | null {
  const e = entity.trim();
  const direct = cacheByTitle.get(e.toLowerCase());
  if (direct) return { title: direct.title, wt: direct.wt };
  for (const v of cacheByTitle.values()) for (const r of v.redirects) if (r?.from && r.from.toLowerCase() === e.toLowerCase()) return { title: v.title, wt: v.wt };
  const norm = (s: string) => s.toLowerCase().replace(/[\s_/]+/g, ' ').trim();
  const en = norm(e);
  for (const v of cacheByTitle.values()) if (norm(v.title) === en && !isSoundtrack(v.title, v.wt)) return { title: v.title, wt: v.wt };
  let fb: any = null;
  for (const v of cacheByTitle.values()) if (v.title.toLowerCase().includes(e.toLowerCase()) && !isSoundtrack(v.title, v.wt)) { if (!fb) fb = v; }
  return fb ? { title: fb.title, wt: fb.wt } : null;
}
function readParentOf(title: string, wt: string): string | null {
  if (isSoundtrack(title, wt)) return null;
  const names = ['Mission Infobox', 'Location Infobox', 'Area Infobox', 'Zone Infobox', 'Mission', 'Location', 'Area', 'Zone'];
  let ib: any = null;
  for (const n of names) { ib = parseInfobox(wt, n); if (ib && Object.keys(ib).length) break; }
  if (ib) for (const f of ['location', 'area', 'subarea', 'region', 'zone', 'world', 'planet', 'system']) { const v = ib[f]; if (!v) continue; const c = v.replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1').replace(/\s*\((Location|Area|Region|Zone|Disambiguation|Mission)\)/gi, '').replace(/'''?/g, '').trim(); if (c && c.toLowerCase() !== title.toLowerCase()) return c; }
  return null;
}
for (const ent of ['Version 2.7', 'Version 3.1', 'Version 1.2']) {
  const c = findCache(ent);
  if (!c) { console.log(ent, '-> NO CACHE PAGE'); continue; }
  const ol = parseOtherLanguages(c.wt);
  const parent = readParentOf(c.title, c.wt);
  console.log(ent, '-> page="' + c.title + '"' + (isSoundtrack(c.title, c.wt) ? ' [SOUNDTRACK!!]' : '') + ' zh=' + (ol.zhs || ol.zh || ol.zht || '(none)') + ' parent=' + (parent || '(none)'));
}
// also list what version pages exist in cache
const vpages = [...cacheByTitle.values()].filter((v) => /^version[\s/]?\d/i.test(v.title)).slice(0, 10).map((v) => v.title);
console.log('\ncache Version pages sample:', vpages.join(' | '));
