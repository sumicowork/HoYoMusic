import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { getWikitext, parseOtherLanguages } from './fandomClient';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const client = new Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const WIKI: Record<number, string> = { 1: 'genshin-impact', 2: 'honkai-star-rail' };

async function zhOf(wiki: string, en: string): Promise<string | null> {
  const wt = await getWikitext(wiki, en);
  if (!wt) return null;
  const ol = parseOtherLanguages(wt);
  // prefer zhs, then zht
  const zh = ol['zhs'] || ol['zht'] || ol['zh'] || null;
  return zh && zh !== en ? zh : null;
}

async function main() {
  await client.connect();
  // distinct pending en_names per game, sampled
  const rows = await client.query(`
    select game_id, en_name from music_source_nodes
    where translation_status='pending' and en_name is not null and en_name <> ''
    group by game_id, en_name
  `);
  const byGame: Record<number, string[]> = { 1: [], 2: [] };
  for (const r of rows.rows) byGame[r.game_id].push(r.en_name);

  const SAMPLE = 45;
  for (const gid of [1, 2]) {
    const sample = byGame[gid].slice(0, SAMPLE);
    let hit = 0;
    const resolved: string[] = [];
    const missed: string[] = [];
    for (const en of sample) {
      let zh: string | null = null;
      try { zh = await zhOf(WIKI[gid], en); } catch (e) { /* rate/network */ }
      if (zh) { hit++; resolved.push(`${en} → ${zh}`); }
      else missed.push(en);
    }
    console.log(`\n=== GAME ${gid} (sampled ${sample.length}) ===`);
    console.log(`resolved to Chinese: ${hit}/${sample.length}  (${(hit / sample.length * 100).toFixed(0)}%)`);
    console.log('-- resolved samples --');
    resolved.slice(0, 12).forEach((s) => console.log('  ' + s));
    console.log('-- still-pending samples --');
    missed.slice(0, 12).forEach((s) => console.log('  ' + s));
  }
  await client.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
