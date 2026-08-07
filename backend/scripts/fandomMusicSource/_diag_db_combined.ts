/**
 * READ-ONLY: check the DB side. Does the HSR tracks table store COMBINED titles
 * (e.g. "A / B", "A — B") that fandom lists as separate songs? If so, splitting
 * the DB title would be needed. Also: how many DB HSR tracks have NO fandom entry
 * at all (true coverage gap on the DB side).
 */
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function normAgg(s: string): string {
  return (s || '').toLowerCase().replace(/[""'""'']/g, '').replace(/\([^)]*\)/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

async function main() {
  const client = new Client({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  });
  await client.connect();

  const rows = (await client.query(
    `select t.id, t.title_en from tracks t join albums a on t.album_id=a.id where a.game_id=2 and t.title_en is not null`
  )).rows;
  console.log(`DB HSR tracks: ${rows.length}`);

  // fandom dataset title set
  const data = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'out/music-source-dataset.json'), 'utf8'));
  const fandomSet = new Set<string>();
  for (const t of (data['hsr']?.tracks || [])) {
    const raw = t.otherLanguages?.en || t.pageTitle || t.trackTitle || '';
    fandomSet.add(normAgg(raw));
  }

  // 1) DB titles containing delimiter (potential combined)
  const delim = /(\s\/\s|\s[—–-]\s|,| & | feat\.| vs\.? )/i;
  const combined = rows.filter((r: any) => delim.test(r.title_en));
  console.log(`\nDB HSR titles containing a delimiter (potential combined): ${combined.length}`);
  for (const r of combined.slice(0, 40)) console.log(`  "${r.title_en}"`);

  // 2) DB tracks with NO fandom entry (coverage gap on DB side)
  let noFandom = 0;
  const missSamples: string[] = [];
  for (const r of rows) {
    if (!fandomSet.has(normAgg(r.title_en))) { noFandom++; if (missSamples.length < 40) missSamples.push(r.title_en); }
  }
  console.log(`\nDB HSR tracks with NO fandom entry (agg-exact): ${noFandom} / ${rows.length}`);
  console.log('  samples:');
  for (const s of missSamples) console.log(`    "${s}"`);

  await client.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
