import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const client = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
async function main() {
  await client.connect();
  // 1) backup current full state
  const ts = Date.now();
  const bak = `track_music_sources_bak_precatfix_${ts}`;
  await client.query(`CREATE TABLE ${bak} AS SELECT * FROM track_music_sources`);
  console.log(`[backup] ${bak} (snapshot of current 4480 rows)`);
  // 2) surgical fix: align edge.category_id to the matched node's real category
  const r = await client.query(`
    UPDATE track_music_sources e
    SET category_id = m.category_id
    FROM music_source_nodes m
    WHERE e.node_id = m.id AND e.category_id <> m.category_id`);
  console.log(`[fix] updated ${r.rowCount} edge(s) to match node category`);
  // 3) re-verify
  const mis = (await client.query(`
    select count(*) as n from track_music_sources e
    join music_source_nodes m on m.id=e.node_id
    where e.category_id <> m.category_id`)).rows[0].n;
  console.log(`[verify] remaining category mismatches: ${mis}`);
  await client.end();
}
main().catch(e=>{console.error(e);process.exit(1);});
