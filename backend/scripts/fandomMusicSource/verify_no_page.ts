import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CACHE = path.resolve(__dirname, '.cache');
const CSV = path.resolve(__dirname, 'out/relookup_gi.csv');

// ---- load fandom cache ----
const cacheByTitle = new Map<string, { title: string; wt: string }>();
for (const f of fs.readdirSync(CACHE).filter((x) => x.endsWith('.json'))) {
  let d: any; try { d = JSON.parse(fs.readFileSync(path.join(CACHE, f), 'utf8')); } catch { continue; }
  const p = d?.parse; if (!p || !p.title) continue;
  cacheByTitle.set(p.title.toLowerCase(), { title: p.title, wt: p.wikitext?.['*'] || '' });
}

function otherLangZh(wt: string): string {
  const m = wt.match(/{{Other Languages([\s\S]*?)}}/i);
  if (!m) return '';
  const o: Record<string, string> = {};
  for (const l of m[1].split(/\n/)) {
    const mm = l.match(/^\s*\|?\s*([a-z0-9_]+)\s*=\s*(.+?)\s*$/i);
    if (mm) o[mm[1].toLowerCase().replace(/^\d+_/, '')] = mm[2].replace(/{{[^}]*}}/g, '').trim();
  }
  return o.zhs || o.zht || '';
}
function norm(s: string) { return s.trim().toLowerCase().replace(/\s+/g, ' '); }

// aggressive normalization of a node name into plausible article titles
function variants(en: string): string[] {
  const set = new Set<string>();
  let s = en.trim();
  set.add(s);
  // strip trailing disambiguation like (Quest), (World Quest), (Event), (Location)...
  const stripped = s.replace(/\s*[\(\[].*?[\)\]]$/, '').trim();
  if (stripped && stripped !== s) set.add(stripped);
  // slash -> space  (Version/4.2 -> Version 4.2)
  const slashed = s.replace(/\//g, ' ').replace(/\s+/g, ' ').trim();
  if (slashed !== s) set.add(slashed);
  if (stripped) { const sl2 = stripped.replace(/\//g, ' ').replace(/\s+/g, ' ').trim(); if (sl2 !== slashed) set.add(sl2); }
  return [...set].filter(Boolean);
}

function resolve(en: string): { title: string; zh: string } | null {
  // 1) exact (case-insensitive)
  for (const v of variants(en)) {
    const hit = cacheByTitle.get(norm(v));
    if (hit && /{{Other Languages/i.test(hit.wt)) {
      const zh = otherLangZh(hit.wt);
      if (zh) return { title: hit.title, zh };
    }
  }
  // 2) substring: cache title contains the stripped needle or vice versa
  const needle = norm(strippedOnly(en));
  if (needle.length < 3) return null;
  let best: { title: string; wt: string } | null = null;
  for (const v of cacheByTitle.values()) {
    if (!/{{Other Languages/i.test(v.wt)) continue;
    const t = norm(v.title);
    if (t.includes(needle) || needle.includes(t)) { best = v; break; }
  }
  if (best) { const zh = otherLangZh(best.wt); if (zh) return { title: best.title, zh }; }
  return null;
}
function strippedOnly(en: string) { return en.trim().replace(/\s*[\(\[].*?[\)\]]$/, '').replace(/\//g, ' ').trim(); }

function classifyJunk(en: string): string {
  const e = en.trim().toLowerCase();
  if (/^(cutscene|event|story|promo|teaser|trailer|version|boss|character|area|location|other|misc|unknown|none|null|n\/a)$/.test(e)) return 'JUNK_token';
  if (/^v?\d+\.\d+(\.\d+)?$/.test(e)) return 'JUNK_versionnum';
  return '';
}

// ---- read NO_PAGE rows ----
const lines = fs.readFileSync(CSV, 'utf8').split('\n').filter((l) => l.trim());
const header = lines.shift()!;
void header;
const noPage: { id: string; en: string }[] = [];
for (const l of lines) {
  if (!l.trim().endsWith('NO_PAGE')) continue;
  // parse: id,"en",... NO_PAGE
  const firstComma = l.indexOf(',');
  const lastComma = l.lastIndexOf(',');
  const id = l.slice(0, firstComma);
  let en = l.slice(firstComma + 1, lastComma);
  // strip surrounding quotes
  if (en.startsWith('"') && en.endsWith('"')) en = en.slice(1, -1);
  noPage.push({ id, en });
}

let RESOLVED = 0, STILL_NO = 0;
const stillNo: string[] = [];
const resolvedSamples: string[] = [];
const junk: string[] = [];
let questSuffix = 0, versionSlash = 0;

for (const { id, en } of noPage) {
  if (/\(\s*(Quest|World Quest|Event|Story|Commission)\s*\)/i.test(en)) questSuffix++;
  if (en.includes('/')) versionSlash++;
  const j = classifyJunk(en);
  if (j) { junk.push(`${id}\t${en}\t${j}`); STILL_NO++; stillNo.push(`${id}\t${en}\tJUNK`); continue; }
  const r = resolve(en);
  if (r) {
    RESOLVED++;
    if (resolvedSamples.length < 25) resolvedSamples.push(`${id}\t"${en}"\t->\t"${r.zh}"\t[${r.title}]`);
  } else {
    STILL_NO++;
    if (stillNo.length < 60) stillNo.push(`${id}\t${en}`);
  }
}

console.log(`NO_PAGE 总数: ${noPage.length}`);
console.log(`  其中带 (Quest) 等后缀: ${questSuffix}`);
console.log(`  其中含 '/': ${versionSlash}`);
console.log(`  复查后【可解析出中文】: ${RESOLVED}`);
console.log(`  复查后【仍无页面/无中文】: ${STILL_NO}`);
console.log(`  (其中垃圾节点 JUNK: ${junk.length})`);
console.log(`\n--- 复查可解析样本(前25) ---`);
resolvedSamples.forEach((s) => console.log('  ' + s));
console.log(`\n--- 复查仍无(前60) ---`);
stillNo.forEach((s) => console.log('  ' + s));

fs.writeFileSync(path.resolve(__dirname, 'out/relookup_gi_nopage_recheck.csv'),
  'id,en,verdict\n' + resolvedSamples.map((s) => s.split('\t').join(',') + ',RESOLVED').join('\n') + '\n' +
  stillNo.map((s) => s.split('\t').join(',') + (s.includes('JUNK') ? '' : ',STILL_NO')).join('\n') + '\n');
