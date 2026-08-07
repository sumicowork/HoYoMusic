import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function norm(s: string): string {
  return (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}
// aggressive normalization: strip quotes, parens-subtitles, punctuation
function normAgg(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[""'""']/g, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  const client = new Client({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  });
  await client.connect();

  const data = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'out/music-source-dataset.json'), 'utf8'));
  const gameFor: Record<string, number> = { genshin: 1, hsr: 2 };

  for (const gkey of ['genshin', 'hsr']) {
    const gid = gameFor[gkey];
    // all DB titles (norm + normAgg)
    const rows = (await client.query(
      `select t.title_en from tracks t join albums a on t.album_id=a.id where a.game_id=$1`, [gid]
    )).rows;
    const exact = new Set(rows.map((r: any) => norm(r.title_en)));
    const agg = new Map<string, string>();
    for (const r of rows) { const a = normAgg(r.title_en); if (a) agg.set(a, r.title_en); }

    const tracks = data[gkey].tracks as any[];
    let unmatched = 0, recoverExact = 0, recoverAgg = 0, stillLost = 0;
    const lostSamples: string[] = [];
    for (const t of tracks) {
      const en = norm(t.otherLanguages?.en || t.pageTitle || t.trackTitle || '');
      if (!en) continue;
      if (exact.has(en)) continue;            // already matched by count_edges
      unmatched++;
      if (exact.has(norm(en))) { recoverExact++; continue; }
      const a = normAgg(en);
      if (agg.has(a)) { recoverAgg++; continue; }
      stillLost++;
      if (lostSamples.length < 8) lostSamples.push(en);
    }
    console.log(`\n=== ${gkey} (game ${gid}) ===`);
    console.log(`  dataset曲目: ${tracks.length}`);
    console.log(`  原统计"未匹配DB": ${unmatched}`);
    console.log(`    其中靠更激进归一可救回(精确再归一): ${recoverExact}`);
    console.log(`    其中靠去引号/去副标题可救回: ${recoverAgg}`);
    console.log(`    真·库里找不到(fandom独有或写法差异过大): ${stillLost}`);
    if (lostSamples.length) console.log(`    真丢失样本: ${lostSamples.slice(0,5).join(' | ')}`);
  }
  await client.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
