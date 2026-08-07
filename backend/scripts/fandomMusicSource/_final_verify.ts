import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const client = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
async function main() {
  await client.connect();
  const n = (await client.query(`select count(*) as n from track_music_sources`)).rows[0].n;
  const orphan = (await client.query(`select count(*) as n from track_music_sources e left join tracks t on t.id=e.track_id left join music_source_nodes m on m.id=e.node_id where t.id is null or m.id is null`)).rows[0].n;
  const mis = (await client.query(`select count(*) as n from track_music_sources e join music_source_nodes m on m.id=e.node_id where e.category_id<>m.category_id`)).rows[0].n;
  const songs = (await client.query(`select count(distinct track_id) as n from track_music_sources`)).rows[0].n;
  const perGame = (await client.query(`select g.name as game, count(*) as edges, count(distinct e.track_id) as songs from track_music_sources e join games g on g.id=e.game_id group by g.name`)).rows;
  console.log(`=== 最终一致性 ===`);
  console.log(`总边数: ${n} | 覆盖曲数: ${songs} | 孤儿边: ${orphan} | 分类错配: ${mis}`);
  for (const r of perGame) console.log(`  ${r.game}: ${r.edges} 边 / ${r.songs} 曲`);
  await client.end();
}
main().catch(e=>{console.error(e);process.exit(1);});
