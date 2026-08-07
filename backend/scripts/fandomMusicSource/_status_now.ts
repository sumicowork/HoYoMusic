import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const client = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
async function main() {
  await client.connect();
  const nodes = (await client.query(`
    select game_id, translation_status, count(*) as n
    from music_source_nodes group by game_id, translation_status order by game_id, translation_status`))
    .rows;
  const cats = (await client.query(`select game_id, count(*) as n from music_source_categories group by game_id order by game_id`)).rows;
  const edges = (await client.query(`select count(*) as n from track_music_sources`)).rows[0];
  const tracks = (await client.query(`select count(*) as n from tracks`)).rows[0];
  console.log('=== music_source_nodes (按游戏/翻译状态) ===');
  for (const r of nodes) console.log(`  game_id=${r.game_id} ${r.translation_status}: ${r.n}`);
  console.log('=== music_source_categories ===');
  for (const r of cats) console.log(`  game_id=${r.game_id}: ${r.n} 分类`);
  console.log(`\n=== track_music_sources 边表(歌曲↔场景关联) ===\n  行数 = ${edges.n}  (tracks 总曲数 = ${tracks.n})`);
  await client.end();
}
main().catch(e=>{console.error(e);process.exit(1);});
