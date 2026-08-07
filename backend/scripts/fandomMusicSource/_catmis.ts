import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const client = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
async function main() {
  await client.connect();
  const rows = (await client.query(`
    select t.title_en as song, m.en_name as place, c1.en_name as edge_cat, c2.en_name as node_cat, e.category_id as ec, m.category_id as nc
    from track_music_sources e
    join tracks t on t.id=e.track_id
    join music_source_nodes m on m.id=e.node_id
    join music_source_categories c1 on c1.id=e.category_id
    join music_source_categories c2 on c2.id=m.category_id
    where e.category_id <> m.category_id
    limit 20`)).rows;
  for (const r of rows) console.log(`「${r.song}」→ ${r.place}: edge_cat=${r.edge_cat}(${r.ec}) vs node_cat=${r.node_cat}(${r.nc})`);
  await client.end();
}
main().catch(e=>{console.error(e);process.exit(1);});
