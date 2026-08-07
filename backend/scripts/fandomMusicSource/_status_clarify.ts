import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const client = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
async function main() {
  await client.connect();
  // 1) NODE tree translation status by game
  console.log('=== 地点节点树 翻译状态(按游戏) ===');
  const nodes = (await client.query(`
    select g.name as game, count(*) as total,
      count(*) filter (where n.translation_status='translated') as translated,
      count(*) filter (where n.translation_status='pending') as pending
    from music_source_nodes n join games g on g.id=n.game_id
    group by g.name order by g.name`)).rows;
  for (const r of nodes) {
    const pct = ((r.translated / r.total) * 100).toFixed(1);
    console.log(`  ${r.game}: 共${r.total}节点 | 已译${r.translated}(${pct}%) | 待译${r.pending}`);
  }
  // 2) EDGES pointing to translated vs pending nodes, by game
  console.log('\n=== 已建边(4480条) 指向节点的翻译状态(按游戏) ===');
  const edges = (await client.query(`
    select g.name as game, count(*) as edges,
      count(*) filter (where n.translation_status='translated') as to_zh,
      count(*) filter (where n.translation_status='pending') as to_en
    from track_music_sources e
    join games g on g.id=e.game_id
    join music_source_nodes n on n.id=e.node_id
    group by g.name order by g.name`)).rows;
  for (const r of edges) {
    const pct = ((r.to_zh / r.edges) * 100).toFixed(1);
    console.log(`  ${r.game}: ${r.edges}边 | 指向已译中文${r.to_zh}(${pct}%) | 指向英文${r.to_en}`);
  }
  // 3) covered songs: how many have >=1 Chinese location vs all-English
  console.log('\n=== 被覆盖的歌曲: 是否至少有1个中文地点 ===');
  const songs = (await client.query(`
    with s as (
      select e.track_id,
        bool_or(n.translation_status='translated') as has_zh
      from track_music_sources e
      join music_source_nodes n on n.id=e.node_id
      group by e.track_id)
    select count(*) as covered,
      count(*) filter (where has_zh) as with_zh,
      count(*) filter (where not has_zh) as all_en
    from s`)).rows[0];
  console.log(`  共覆盖${songs.covered}首 | 至少1中文地点${songs.with_zh}首 | 全英文地点${songs.all_en}首`);
  await client.end();
}
main().catch(e=>{console.error(e);process.exit(1);});
