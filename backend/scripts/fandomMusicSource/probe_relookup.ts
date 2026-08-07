/**
 * Read-only re-lookup probe for the 27 misplant-pending HSR nodes.
 *
 * For each of the 27 TRUE-BUG nodes (song-title planted as scene name, now
 * reverted to `pending`), this script:
 *   1. re-derives the exact 27 target IDs from the pre-remediation backup
 *      table using the same `ss>0 && ns===0` cache detector (no DB writes),
 *   2. takes the node's dirty `en_name`,
 *   3. runs the HARDENED `resolveEntity` (extractEntity + findArticle that
 *      rejects soundtrack pages + parseOtherLanguages) to recover the clean
 *      entity name and any authoritative Chinese,
 *   4. classifies each as:
 *        FILL_ZH   - a real fandom entity page exists with a Chinese name
 *                   -> we CAN write back a correct translated `name`
 *        FILL_EN   - a real entity page exists but has NO Chinese (version /
 *                   UI / English-only) -> we CAN at least store the clean
 *                   English entity (data hygiene), stays `pending`
 *        NO_PAGE  - no resolvable fandom entity page -> must stay as-is
 *                   (honest pending, no fabrication)
 *
 * It writes NO data. Output: console summary + out/relookup_27.csv.
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

const SKIP = new Set([7239, 7408, 7409, 7478]); // 3 char names + 1 user-review (not in the 27)
const BAK = 'music_source_nodes_bugfix_bak_1783842493631';
const WIKI = 'honkai-star-rail';

const client = new Client({
  host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
});

async function main() {
  await client.connect();

  // 1. re-derive the exact 27 targets from the pre-remediation backup
  const bakRows = (await client.query(`select id, name, en_name from ${BAK} where game_id=2`)).rows;
  const targets = bakRows
    .filter((r: any) => { if (SKIP.has(r.id)) return false; const { ns, ss } = pagesZh(r.name); return ss > 0 && ns === 0; })
    .map((r: any) => r.id);
  console.log(`Re-derived TRUE-BUG targets from backup: ${targets.length}`);

  // 2. fetch current (post-remediation) state of those nodes
  const cur = (await client.query(
    `select id, en_name, name, translation_status from music_source_nodes where id = any($1)`,
    [targets],
  )).rows;
  console.log(`Fetched current state of ${cur.length} nodes\n`);

  // 3. re-lookup each with the hardened resolver
  const out: any[] = [];
  let fillZh = 0, fillEn = 0, noPage = 0;
  for (const r of cur) {
    const dirty = r.en_name as string;
    const res = await resolveEntity(WIKI, dirty);
    const cleanEntity = res.entity;
    const ownZh = res.zhPath?.[0] || '';
    const resolved = res.resolved && res.method !== 'no-article';
    // fillable judgement
    let verdict: string, fillValue = '';
    if (resolved && ownZh && ownZh !== cleanEntity) {
      verdict = 'FILL_ZH'; fillValue = ownZh; fillZh++;
    } else if (resolved && cleanEntity) {
      verdict = 'FILL_EN'; fillValue = cleanEntity; fillEn++;
    } else {
      verdict = 'NO_PAGE'; fillValue = ''; noPage++;
    }
    out.push({
      id: r.id,
      dirty_en: dirty,
      clean_entity: cleanEntity,
      kind: res.kind,
      resolved: resolved,
      found_page: res.enPath?.[0] || '',
      zh_from_page: ownZh,
      verdict,
      fill_value: fillValue,
      note: res.note || '',
    });
    console.log(
      `#${r.id} [${verdict}] ${dirty.replace(/\n/g, ' ').slice(0, 48)} -> ` +
      `${cleanEntity.slice(0, 32)} | zh="${ownZh}" (${res.kind})`,
    );
  }

  // 4. write CSV
  const csvPath = path.resolve(__dirname, 'out/relookup_27.csv');
  const header = 'id,verdict,kind,dirty_en,clean_entity,found_page,zh_from_page,fill_value,note\n';
  const csv = header + out.map((o) =>
    [o.id, o.verdict, o.kind, JSON.stringify(o.dirty_en), JSON.stringify(o.clean_entity), JSON.stringify(o.found_page), JSON.stringify(o.zh_from_page), JSON.stringify(o.fill_value), JSON.stringify(o.note)].join(','),
  ).join('\n');
  fs.writeFileSync(csvPath, csv);

  console.log(`\n=== SUMMARY ===`);
  console.log(`FILL_ZH (correct Chinese available): ${fillZh}`);
  console.log(`FILL_EN (real entity, no Chinese -> clean English + pending): ${fillEn}`);
  console.log(`NO_PAGE (no resolvable entity -> stay honest pending): ${noPage}`);
  console.log(`CSV -> ${csvPath}`);

  await client.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
