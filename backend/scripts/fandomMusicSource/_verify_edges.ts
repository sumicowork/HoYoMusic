import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const client = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
async function main() {
  await client.connect();
  const n = (await client.query(`select count(*) as n from track_music_sources`)).rows[0].n;
  console.log('总边数:', n);
  // orphan check: every edge's node_id & track_id must exist
  const orphan = (await client.query(`
    select count(*) as n from track_music_sources e
    left join tracks t on t.id=e.track_id
    left join music_source_nodes m on m.id=e.node_id
    where t.id is null or m.id is null`)).rows[0].n;
  console.log('孤儿边(指向不存在的曲或节点):', orphan);
  // category mismatch check: edge.category_id must match node.category_id
  const catMis = (await client.query(`
    select count(*) as n from track_music_sources e
    join music_source_nodes m on m.id=e.node_id
    where e.category_id <> m.category_id`)).rows[0].n;
  console.log('分类错配(edge.category≠node.category):', catMis);
  // sample readable
  const rows = (await client.query(`
    select t.title_en as song, m.name as place_zh, m.en_name as place_en, m.translation_status as st, c.en_name as cat
    from track_music_sources e
    join tracks t on t.id=e.track_id
    join music_source_nodes m on m.id=e.node_id
    join music_source_categories c on c.id=e.category_id
    order by e.id limit 12`)).rows;
  console.log('\n样本(歌 → 地点[分类]):');
  for (const r of rows) console.log(`  「${r.song}」 → ${r.st==='translated'?r.place_zh:r.place_en}  [${r.cat}] (${r.st})`);
  await client.end();
}
main().catch(e=>{console.error(e);process.exit(1);});
