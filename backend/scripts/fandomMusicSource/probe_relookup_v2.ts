/**
 * Re-lookup probe v2 — with song-title guard.
 *
 * v1 naively trusted resolveEntity's zh, but resolveEntity still fuzzy-matches
 * some SONG pages (those without "Soundtrack" in title / using a different
 * infobox template), planting song titles as "Chinese". This v2 re-classifies
 * every candidate zh with the SAME detector used to find the original 27 bugs:
 *   a zh is a SONG-PLANT if it appears ONLY in fandom Soundtrack pages
 *   (pagesZh.ss>0 && ns===0) OR it equals some track's title_cn.
 *
 * Verdicts:
 *   REAL_FILL  - resolveEntity returned a zh that is NOT a song (authoritative)
 *   REJECT_SONG- resolveEntity returned a zh, but it IS a song title (still a bug)
 *   FILL_EN    - real entity page exists, no Chinese -> clean English (pending)
 *   NO_PAGE    - no resolvable fandom entity -> honest pending
 *
 * Read-only (SELECT only). Output: out/relookup_27_v2.csv
 */
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { resolveEntity } from './adapters/resolve';

const CACHE = path.resolve(__dirname, '.cache');
const cacheByTitle = new Map<string, { title: string; wt: string }>();
for (const f of fs.readdirSync(CACHE).filter((x) => x.endsWith('.json'))) {
  let d: any;
  try { d = JSON.parse(fs.readFileSync(path.join(CACHE, f), 'utf8')); } catch { continue; }
  const p = d?.parse; if (!p || !p.title) continue;
  cacheByTitle.set(p.title.toLowerCase(), { title: p.title, wt: p.wikitext?.['*'] || '' });
}
function isSound(t: string, w: string) { return /soundtrack/i.test(t) || /{{Soundtrack Infobox/i.test(w); }
function pagesZh(zh: string): { ns: number; ss: number } {
  let ns = 0, ss = 0;
  for (const v of cacheByTitle.values()) {
    const m = v.wt.match(/{{Other Languages([\s\S]*?)}}/i); if (!m) continue;
    const o: Record<string, string> = {};
    for (const l of m[1].split(/\n/)) {
      const mm = l.match(/^\s*\|?\s*([a-z0-9_]+)\s*=\s*(.+?)\s*$/i);
      if (mm) o[mm[1].toLowerCase().replace(/^\d+_/, '')] = mm[2].replace(/{{[^}]*}}/g, '').trim();
    }
    if (o.zhs === zh || o.zht === zh) { if (isSound(v.title, v.wt)) ss++; else ns++; }
  }
  return { ns, ss };
}

const SKIP = new Set([7239, 7408, 7409, 7478]);
const BAK = 'music_source_nodes_bugfix_bak_1783842493631';
const WIKI = 'honkai-star-rail';

const trackCn: Set<string> = new Set(JSON.parse(fs.readFileSync(path.resolve(__dirname, 'out/_tracks_cn.json'), 'utf8')));

function isSongZh(zh: string): boolean {
  if (!zh) return false;
  if (trackCn.has(zh.trim())) return true;
  const r = pagesZh(zh);
  return r.ss > 0 && r.ns === 0;
}

const client = new Client({
  host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
});

async function main() {
  await client.connect();
  const bakRows = (await client.query('select id, name, en_name from ' + BAK + ' where game_id=2')).rows;
  const targets = bakRows
    .filter((r: any) => { if (SKIP.has(r.id)) return false; const r2 = pagesZh(r.name); return r2.ss > 0 && r2.ns === 0; })
    .map((r: any) => r.id);
  console.log('Re-derived TRUE-BUG targets: ' + targets.length);

  const cur = (await client.query(
    'select id, en_name, name, translation_status from music_source_nodes where id = any($1)',
    [targets],
  )).rows;

  const out: any[] = [];
  let real = 0, reject = 0, fillEn = 0, noPage = 0;
  for (const r of cur) {
    const dirty = r.en_name as string;
    const res = await resolveEntity(WIKI, dirty);
    const cleanEntity = res.entity;
    const ownZh = res.zhPath?.[0] || '';
    const resolved = res.resolved && res.method !== 'no-article';

    let verdict: string, fillValue = '';
    const songHit = isSongZh(ownZh);
    if (resolved && ownZh && songHit) {
      verdict = 'REJECT_SONG'; fillValue = ''; reject++;
    } else if (resolved && ownZh && ownZh !== cleanEntity) {
      verdict = 'REAL_FILL'; fillValue = ownZh; real++;
    } else if (resolved && cleanEntity) {
      verdict = 'FILL_EN'; fillValue = cleanEntity; fillEn++;
    } else {
      verdict = 'NO_PAGE'; fillValue = ''; noPage++;
    }
    out.push({
      id: r.id, dirty_en: dirty, clean_entity: cleanEntity, kind: res.kind,
      resolved, found_page: res.enPath?.[0] || '', zh_from_page: ownZh,
      song_plant: songHit, verdict, fill_value: fillValue, note: res.note || '',
    });
    console.log('#' + r.id + ' [' + verdict + '] ' + dirty.replace(/\n/g, ' ').slice(0, 46) + ' -> zh="' + ownZh.slice(0, 24) + '"' + (songHit ? ' (SONG!)' : ''));
  }

  const csvPath = path.resolve(__dirname, 'out/relookup_27_v2.csv');
  const header = 'id,verdict,kind,dirty_en,clean_entity,found_page,zh_from_page,song_plant,fill_value,note\n';
  const csv = header + out.map((o) =>
    [o.id, o.verdict, o.kind, JSON.stringify(o.dirty_en), JSON.stringify(o.clean_entity), JSON.stringify(o.found_page), JSON.stringify(o.zh_from_page), o.song_plant, JSON.stringify(o.fill_value), JSON.stringify(o.note)].join(','),
  ).join('\n');
  fs.writeFileSync(csvPath, csv);

  console.log('\n=== SUMMARY (with song guard) ===');
  console.log('REAL_FILL   (authoritative Chinese, NOT a song): ' + real);
  console.log('REJECT_SONG (resolved zh is STILL a song title): ' + reject);
  console.log('FILL_EN     (real entity, no Chinese):           ' + fillEn);
  console.log('NO_PAGE     (no resolvable entity):              ' + noPage);
  console.log('CSV -> ' + csvPath);
  await client.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
