import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const CACHE = path.resolve(__dirname, '.cache');
const OUT = path.resolve(__dirname, 'out/relookup_gi.csv');

function isSound(t: string, w: string) {
  return /soundtrack/i.test(t) || /{{Soundtrack Infobox/i.test(w);
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

// ---- load fandom cache ----
const cacheByTitle = new Map<string, { title: string; wt: string }>();
for (const f of fs.readdirSync(CACHE).filter((x) => x.endsWith('.json'))) {
  let d: any; try { d = JSON.parse(fs.readFileSync(path.join(CACHE, f), 'utf8')); } catch { continue; }
  const p = d?.parse; if (!p || !p.title) continue;
  cacheByTitle.set(p.title.toLowerCase(), { title: p.title, wt: p.wikitext?.['*'] || '' });
}

// reverse index: zh -> providers
const zhProviders = new Map<string, { title: string; isSound: boolean }[]>();
for (const v of cacheByTitle.values()) {
  const zh = otherLangZh(v.wt);
  if (!zh) continue;
  const arr = zhProviders.get(zh) || [];
  arr.push({ title: v.title, isSound: isSound(v.title, v.wt) });
  zhProviders.set(zh, arr);
}

function norm(s: string) { return s.trim().toLowerCase(); }
function candidates(en: string): string[] {
  const raw = en.trim();
  const set = new Set<string>([raw]);
  const slash = raw.split('/').pop()!;
  if (slash && slash !== raw) set.add(slash);
  const pipe = raw.split('|')[0];
  if (pipe && pipe !== raw) set.add(pipe);
  return [...set].filter(Boolean);
}
function findCandidate(en: string): { title: string; wt: string } | null {
  for (const c of candidates(en)) {
    const hit = cacheByTitle.get(norm(c));
    if (hit && /{{Other Languages/i.test(hit.wt)) return hit;
  }
  // fuzzy: cache title contains the en (non-soundtrack preferred)
  const needle = norm(en);
  let best: { title: string; wt: string } | null = null;
  for (const v of cacheByTitle.values()) {
    if (!/{{Other Languages/i.test(v.wt)) continue;
    if (norm(v.title).includes(needle) || needle.includes(norm(v.title))) {
      if (isSound(v.title, v.wt)) { if (!best) best = v; }
      else { best = v; break; }
    }
  }
  return best;
}

const client = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });

async function main() {
  await client.connect();
  // track title_cn set for anti-song guard
  const tc = (await client.query(`select title_cn from tracks where title_cn is not null and title_cn <> ''`)).rows;
  const trackZh = new Set<string>(tc.map((r: any) => r.title_cn.trim()));

  const rows = (await client.query(`select id, name, en_name, category_id from music_source_nodes where game_id=1 and translation_status='pending'`)).rows;
  console.log(`原神 pending 节点总数: ${rows.length}`);

  const out: string[] = ['id,en_name,proposed_zh,source_title,verdict'];
  let FILL = 0, NO_PAGE = 0, REJECT_SONG = 0;
  const sampleFill: string[] = [];
  const sampleReject: string[] = [];

  for (const r of rows) {
    const en = (r.en_name || r.name || '').trim();
    const cand = findCandidate(en);
    if (!cand) { NO_PAGE++; out.push(`${r.id},"${en}","","",NO_PAGE`); continue; }
    const zh = otherLangZh(cand.wt);
    if (!zh) { NO_PAGE++; out.push(`${r.id},"${en}","","${cand.title}",NO_PAGE`); continue; }
    // anti-song guard
    const prov = zhProviders.get(zh) || [];
    const ns = prov.filter((p) => !p.isSound).length;
    const ss = prov.filter((p) => p.isSound).length;
    const isTrackTitle = trackZh.has(zh);
    if (ns === 0 || isTrackTitle) {
      REJECT_SONG++;
      if (sampleReject.length < 12) sampleReject.push(`#${r.id} "${en}" -> "${zh}" (ns=${ns},ss=${ss},trackTitle=${isTrackTitle})`);
      out.push(`${r.id},"${en}","${zh}","${cand.title}",REJECT_SONG`);
      continue;
    }
    FILL++;
    if (sampleFill.length < 12) sampleFill.push(`#${r.id} "${en}" -> "${zh}" [${cand.title}]`);
    out.push(`${r.id},"${en}","${zh}","${cand.title}",FILL_ZH`);
  }

  fs.writeFileSync(OUT, out.join('\n'));
  console.log(`\n=== 结果 ===`);
  console.log(`  FILL_ZH (可补正确中文): ${FILL}`);
  console.log(`  REJECT_SONG (仍是曲名/只来自歌曲页): ${REJECT_SONG}`);
  console.log(`  NO_PAGE (fandom无对应实体): ${NO_PAGE}`);
  console.log(`  CSV -> ${OUT}`);
  console.log(`\n--- FILL 样本 ---`);
  sampleFill.forEach((s) => console.log('  ' + s));
  console.log(`\n--- REJECT 样本 ---`);
  sampleReject.forEach((s) => console.log('  ' + s));
  await client.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
