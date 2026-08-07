import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const CACHE = path.resolve(__dirname, '.cache');

// ---- load fandom cache (offline resolve) ----
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
function variants(en: string): string[] {
  const set = new Set<string>(); let s = en.trim(); set.add(s);
  const stripped = s.replace(/\s*[\(\[].*?[\)\]]$/, '').trim();
  if (stripped && stripped !== s) set.add(stripped);
  const slashed = s.replace(/\//g, ' ').replace(/\s+/g, ' ').trim();
  if (slashed !== s) set.add(slashed);
  if (stripped) { const sl2 = stripped.replace(/\//g, ' ').replace(/\s+/g, ' ').trim(); if (sl2 !== slashed) set.add(sl2); }
  return [...set].filter(Boolean);
}
function resolveOffline(en: string): boolean {
  for (const v of variants(en)) {
    const hit = cacheByTitle.get(norm(v));
    if (hit && /{{Other Languages/i.test(hit.wt) && otherLangZh(hit.wt)) return true;
  }
  const needle = norm(en.replace(/\s*[\(\[].*?[\)\]]$/, '').replace(/\//g, ' ').trim());
  if (needle.length < 3) return false;
  for (const v of cacheByTitle.values()) {
    if (!/{{Other Languages/i.test(v.wt)) continue;
    const t = norm(v.title);
    if (t.includes(needle) || needle.includes(t)) return true;
  }
  return false;
}

// ---- classify junk (free-text, not a real entity) ----
const JUNK_RE = /\b(cutscene|whilst|during|challenge|sequence|\bPOV\b|scene|escape|escaping|fighting|rescue|rescuing|taking control|riding|leaving|surface|interior|dialogue|battle against|evasion|when |after |before |through |approaching|entering|descending|ascending|confronting|defeating|chasing|fleeing|exploring|traversing|navigating|overlooking|overview|cutscene)\b/i;
function isJunk(en: string): boolean {
  const e = en.trim();
  if (/^(cutscene|event|story|promo|teaser|trailer|version|boss|character|area|location|other|misc|unknown|none|null|n\/a)$/i.test(e)) return true;
  if (/^v?\d+\.\d+(\.\d+)?$/.test(e)) return true; // bare version number
  if (JUNK_RE.test(e)) return true;
  // all-lowercase multi-word phrase that isn't a known proper structure
  const words = e.split(/\s+/);
  const lowercased = words.filter((w) => /^[a-z]/.test(w)).length;
  if (words.length >= 3 && lowercased >= Math.ceil(words.length * 0.6)) return true;
  return false;
}

// ---- live fandom lookup ----
let lastCall = 0;
async function liveZh(title: string): Promise<string> {
  const wait = 450 - (Date.now() - lastCall); if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  const url = `https://genshin-impact.fandom.com/api.php?${new URLSearchParams({ action: 'parse', page: title, prop: 'wikitext', redirects: '1', format: 'json' })}`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'HoYoMusic-Rebuild/1.0' } });
    if (!res.ok) return '';
    const d = await res.json();
    const wt = d?.parse?.wikitext?.['*'] || '';
    return otherLangZh(wt);
  } catch { return ''; }
}

const client = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
async function main() {
  await client.connect();
  const rows = (await client.query(`select id, name, en_name from music_source_nodes where game_id=1 and translation_status='pending'`)).rows;
  let totalPending = rows.length;
  let offlineResolved = 0, junk = 0, entity = 0;
  const entitySamples: string[] = [];
  const junkSamples: string[] = [];

  for (const r of rows) {
    const en = (r.en_name || r.name || '').trim();
    if (resolveOffline(en)) { offlineResolved++; continue; }
    if (isJunk(en)) { junk++; if (junkSamples.length < 30) junkSamples.push(`${r.id}\t${en}`); continue; }
    entity++; if (entitySamples.length < 30) entitySamples.push(`${r.id}\t${en}`);
  }

  // live-check a sample of entities (cap 50 to bound runtime)
  const sample = entitySamples.slice(0, 50).map((s) => s.split('\t')[1]);
  let liveOk = 0, liveTotal = 0;
  const liveHits: string[] = [];
  for (const en of sample) {
    liveTotal++;
    const zh = await liveZh(en);
    if (zh) { liveOk++; if (liveHits.length < 20) liveHits.push(`${en} -> ${zh}`); }
  }

  console.log(`原神 pending 节点总数: ${totalPending}`);
  console.log(`  离线已可解析(缓存里有): ${offlineResolved}`);
  console.log(`  离线查不到 -> 分类:`);
  console.log(`    垃圾自由文本节点(非实体, fandom本来就不会有页): ${junk}`);
  console.log(`    正规实体名(任务/版本/地点等, 应有fandom页): ${entity}`);
  console.log(`\n--- 实体名抽样联网查 fandom (样本${liveTotal}) ---`);
  console.log(`  查到且有中文: ${liveOk} / ${liveTotal}`);
  console.log(`--- 联网命中样本 ---`);
  liveHits.forEach((s) => console.log('  ' + s));
  console.log(`\n--- 垃圾节点样本(前30) ---`);
  junkSamples.forEach((s) => console.log('  ' + s));

  await client.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
