/**
 * relookup_gi_v2.ts — 原神 pending 节点补查 v2（只读，不改库）
 *
 * 相对 v1 的三处修复（用户质疑"711 真没有"后查实）：
 *  1) 跟随 {{Other Languages|Transclude=BaseName}}：任务/活动页中文在基名子页，需二次抓取。
 *  2) 归一化后缀/斜杠：X (Quest) / X (Domain) / Version/4.2 -> 候选标题。
 *  3) 剔除垃圾自由文本节点（cutscene / whilst fighting ... 等非实体），归入 DELETE 清单。
 *
 * 反曲名双保险保留：zh 不能是曲库 title_cn；且 zh 的提供页至少有 1 个非曲目页。
 *
 * 输出：out/relookup_gi_v2_fill.csv（可补） + out/relookup_gi_v2_junk.csv（待删垃圾）
 * 全程只读 fandom + 数据库，绝不执行任何 INSERT/UPDATE/DELETE。
 */
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const CACHE = path.resolve(__dirname, '.cache');
const OUT_FILL = path.resolve(__dirname, 'out/relookup_gi_v2_fill.csv');
const OUT_JUNK = path.resolve(__dirname, 'out/relookup_gi_v2_junk.csv');
const OUT_STAT = path.resolve(__dirname, 'out/relookup_gi_v2_stats.json');

// ---------- fandom cache (offline) ----------
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
function isSoundPage(wt: string, title: string): boolean {
  return /{{Soundtrack Infobox/i.test(wt) || /\/Soundtrack/i.test(title) || /soundtrack/i.test(title);
}
function norm(s: string) { return s.trim().toLowerCase().replace(/\s+/g, ' '); }

// offline resolve using cache; returns zh or null
function offlineZh(en: string): string | null {
  const raw = en.trim();
  const cands = new Set<string>([raw]);
  const stripped = raw.replace(/\s*[\(\[].*?[\)\]]$/, '').trim();
  if (stripped && stripped !== raw) cands.add(stripped);
  const slashed = raw.replace(/\//g, ' ').replace(/\s+/g, ' ').trim();
  if (slashed !== raw) cands.add(slashed);
  if (stripped) { const s2 = stripped.replace(/\//g, ' ').replace(/\s+/g, ' ').trim(); if (s2 !== slashed) cands.add(s2); }
  // bare version number -> "Version X.Y"
  if (/^\d+\.\d+(\.\d+)?$/.test(raw)) cands.add('Version ' + raw);
  for (const c of cands) {
    const hit = cacheByTitle.get(norm(c));
    if (hit && /{{Other Languages/i.test(hit.wt)) { const z = otherLangZh(hit.wt); if (z) return z; }
  }
  return null;
}

// ---------- live fandom ----------
const fetchCache = new Map<string, string>(); // title -> wikitext (or '' if missing)
let lastCall = 0;
async function liveWt(title: string): Promise<string> {
  const key = title.trim();
  if (fetchCache.has(key)) return fetchCache.get(key)!;
  const wait = 450 - (Date.now() - lastCall); if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  const url = `https://genshin-impact.fandom.com/api.php?${new URLSearchParams({ action: 'parse', page: key, prop: 'wikitext', redirects: '1', format: 'json' })}`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'HoYoMusic-Rebuild/1.0' } });
    if (!res.ok) { fetchCache.set(key, ''); return ''; }
    const d = await res.json();
    const wt = d?.parse?.wikitext?.['*'] || '';
    fetchCache.set(key, wt);
    return wt;
  } catch { fetchCache.set(key, ''); return ''; }
}

// get zh for an entity, following Transclude
async function liveZh(en: string): Promise<{ zh: string; sources: { title: string; sound: boolean }[] }> {
  const sources: { title: string; sound: boolean }[] = [];
  let wt = await liveWt(en);
  if (!wt) {
    // try base name (strip Quest/Domain suffix, replace slash)
    const base = en.replace(/\s*[\(\[].*?[\)\]]$/, '').replace(/\//g, ' ').trim();
    if (base && base !== en) wt = await liveWt(base);
  }
  if (!wt) return { zh: '', sources };
  const title = en; // nominal
  sources.push({ title, sound: isSoundPage(wt, title) });
  const zh = otherLangZh(wt);
  if (zh) return { zh, sources };
  // Transclude?
  const tm = wt.match(/\{\{Other Languages\|Transclude=([^}]+)\}\}/i);
  if (tm) {
    const baseName = tm[1].trim();
    const bwt = await liveWt(baseName);
    if (bwt) {
      sources.push({ title: baseName, sound: isSoundPage(bwt, baseName) });
      const bzh = otherLangZh(bwt);
      if (bzh) return { zh: bzh, sources };
    }
  }
  return { zh: '', sources };
}

// ---------- junk classifier ----------
const JUNK_RE = /\b(cutscene|whilst|during|challenge|sequence|\bPOV\b|scene|escape|escaping|fighting|rescue|rescuing|taking control|riding|leaving|surface|interior|dialogue|battle against|evasion|when |after |before |through |approaching|entering|descending|ascending|confronting|defeating|chasing|fleeing|exploring|traversing|navigating|overlooking|overview)\b/i;
function isJunk(en: string): boolean {
  const e = en.trim();
  if (/^(cutscene|event|story|promo|teaser|trailer|version|boss|character|area|location|other|misc|unknown|none|null|n\/a)$/i.test(e)) return true;
  if (/^v?\d+\.\d+(\.\d+)?$/.test(e)) return true;
  if (JUNK_RE.test(e)) return true;
  const words = e.split(/\s+/);
  const lowercased = words.filter((w) => /^[a-z]/.test(w)).length;
  if (words.length >= 3 && lowercased >= Math.ceil(words.length * 0.6)) return true;
  return false;
}

// ---------- main ----------
const client = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
async function main() {
  await client.connect();
  const tc = (await client.query(`select title_cn from tracks where title_cn is not null and title_cn <> ''`)).rows;
  const trackZh = new Set<string>(tc.map((r: any) => r.title_cn.trim()));

  const rows = (await client.query(`select id, name, en_name, category_id from music_source_nodes where game_id=1 and translation_status='pending'`)).rows;

  const fill: string[] = ['id,en_name,proposed_zh,source_title'];
  const junk: string[] = ['id,en_name,reason'];
  let nOffline = 0, nLive = 0, nJunk = 0, nNoPage = 0;

  for (const r of rows) {
    const en = (r.en_name || r.name || '').trim();
    // 1) offline
    const oz = offlineZh(en);
    if (oz && !trackZh.has(oz)) { nOffline++; fill.push(`${r.id},"${en}","${oz}","cache"`); continue; }
    // 2) junk?
    if (isJunk(en)) { nJunk++; junk.push(`${r.id},"${en}","free-text noise"`); continue; }
    // 3) live
    const { zh, sources } = await liveZh(en);
    if (!zh) { nNoPage++; continue; }
    if (trackZh.has(zh)) { nNoPage++; continue; } // zh is a song title -> reject
    const allSound = sources.length > 0 && sources.every((s) => s.sound);
    if (allSound) { nNoPage++; continue; }
    nLive++;
    const srcTitle = sources.find((s) => !s.sound)?.title || sources[0]?.title || '';
    fill.push(`${r.id},"${en}","${zh}","${srcTitle}"`);
  }

  fs.writeFileSync(OUT_FILL, fill.join('\n'));
  fs.writeFileSync(OUT_JUNK, junk.join('\n'));
  const stats = { total: rows.length, offlineFill: nOffline, liveFill: nLive, junk: nJunk, noPage: nNoPage, fillTotal: nOffline + nLive };
  fs.writeFileSync(OUT_STAT, JSON.stringify(stats, null, 2));

  console.log(JSON.stringify(stats, null, 2));
  console.log(`\nFILL -> ${OUT_FILL}`);
  console.log(`JUNK -> ${OUT_JUNK}`);
  await client.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
