import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const CACHE = path.resolve(__dirname, '.cache');

function isSound(t: string, w: string) {
  return /soundtrack/i.test(t) || /{{Soundtrack Infobox/i.test(w);
}

async function main() {
  const client = new Client({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  });
  await client.connect();

  // 1) DB tracks per game (via albums)
  const dbTracks = (await client.query(`
    select a.game_id, count(*) as n
    from tracks t join albums a on a.id=t.album_id
    group by a.game_id order by a.game_id`)).rows;
  console.log('=== DB tracks per game ===');
  for (const r of dbTracks) console.log(`  game ${r.game_id}: ${r.n} tracks`);

  // 2) dataset.json entries per game
  const dsPath = path.resolve(__dirname, 'out/music-source-dataset.json');
  const ds = JSON.parse(fs.readFileSync(dsPath, 'utf8'));
  const dsArr = Array.isArray(ds) ? ds : (ds.tracks || ds.items || []);
  const byGame: Record<number, any[]> = { 1: [], 2: [] };
  for (const t of dsArr) {
    const g = t.gameId || t.game_id;
    if (g === 1 || g === 2) byGame[g].push(t);
  }
  console.log('\n=== dataset.json entries per game ===');
  for (const g of [1, 2]) console.log(`  game ${g}: ${byGame[g].length} entries`);

  // 3) cache soundtrack pages per game-ish (we can't easily tell game from filename; just count sound pages)
  let soundPages = 0, totalCache = 0;
  const titles: string[] = [];
  for (const f of fs.readdirSync(CACHE).filter((x) => x.endsWith('.json'))) {
    let d: any; try { d = JSON.parse(fs.readFileSync(path.join(CACHE, f), 'utf8')); } catch { continue; }
    const p = d?.parse; if (!p || !p.title) continue;
    totalCache++;
    if (isSound(p.title, p.wikitext?.['*'] || '')) { soundPages++; titles.push(p.title); }
  }
  console.log('\n=== fandom cache ===');
  console.log(`  total cached pages: ${totalCache}`);
  console.log(`  soundtrack (song) pages: ${soundPages}`);

  // 4) dataset entries that have NO locations array / empty locations
  for (const g of [1, 2]) {
    const locCounts = byGame[g].map((t: any) => {
      const locs = t.locations || [];
      return Array.isArray(locs) ? locs.length : 0;
    });
    const withLoc = locCounts.filter((n: number) => n > 0).length;
    const noLoc = locCounts.filter((n: number) => n === 0).length;
    console.log(`\n=== game ${g} dataset location coverage ===`);
    console.log(`  entries with >=1 location: ${withLoc}`);
    console.log(`  entries with 0 locations: ${noLoc}`);
  }

  await client.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
