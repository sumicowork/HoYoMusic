/**
 * READ-ONLY diagnostic: why do HSR dataset tracks fail to match DB tracks?
 * Hypothesis under test: song titles are combined (medley "A / B", "A & B",
 * "A (feat. X)", etc.) on one side but not split, so exact/agg match misses.
 * We list every unmatched HSR title and test whether splitting recovers it.
 */
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function normAgg(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[""'""'']/g, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
// split a combined title into candidate single-song parts
function splitParts(s: string): string[] {
  const cleaned = (s || '').replace(/\(feat\.[^)]*\)/gi, '').replace(/feat\.[^,/&]*/gi, '');
  return cleaned
    .split(/\s*(?:\/|,|&|\||;|·|・| - | vs\.? | and )\s*/i)
    .map((x) => x.trim())
    .filter(Boolean);
}

async function main() {
  const client = new Client({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  });
  await client.connect();

  // DB HSR track titles (game 2)
  const rows = (await client.query(
    `select t.id, t.title_en from tracks t join albums a on t.album_id=a.id where a.game_id=2 and t.title_en is not null`
  )).rows;
  const dbMap = new Map<string, number>();
  const dbAggSet = new Set<string>();
  for (const r of rows) { dbMap.set(normAgg(r.title_en), r.id); dbAggSet.add(normAgg(r.title_en)); }
  console.log(`DB HSR tracks: ${rows.length}`);

  const data = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'out/music-source-dataset.json'), 'utf8'));
  const tracks = (data['hsr']?.tracks || []) as any[];
  console.log(`dataset HSR tracks: ${tracks.length}\n`);

  const unmatched: { raw: string; agg: string; parts: string[]; recoverable: boolean }[] = [];
  let matched = 0;
  for (const t of tracks) {
    const raw = t.otherLanguages?.en || t.pageTitle || t.trackTitle || '';
    const agg = normAgg(raw);
    if (dbMap.has(agg)) { matched++; continue; }
    const parts = splitParts(raw).map(normAgg).filter(Boolean);
    const recoverable = parts.length > 1 && parts.some((p) => dbAggSet.has(p));
    unmatched.push({ raw, agg, parts, recoverable });
  }

  console.log(`matched(exact-agg): ${matched} | unmatched: ${unmatched.length}`);
  const rec = unmatched.filter((u) => u.recoverable);
  console.log(`  of unmatched, recoverable by SPLIT: ${rec.length}\n`);

  console.log('===== unmatched titles that SPLIT would recover =====');
  for (const u of rec) {
    const hits = u.parts.filter((p) => dbAggSet.has(p));
    console.log(`  "${u.raw}"  --split-->  hits: [${hits.join(' | ')}]`);
  }

  console.log('\n===== unmatched titles NOT recovered by split (first 60) =====');
  const notRec = unmatched.filter((u) => !u.recoverable);
  for (const u of notRec.slice(0, 60)) {
    console.log(`  "${u.raw}"` + (u.parts.length > 1 ? `  (parts: ${u.parts.join(' / ')})` : ''));
  }
  console.log(`\n  ...total not-recovered: ${notRec.length}`);
  await client.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
