import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const client = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
async function main() {
  await client.connect();
  const csv = fs.readFileSync(path.resolve(__dirname, 'out/relookup_gi.csv'), 'utf8').split('\n').slice(1);
  const fillIds = new Set<number>();
  for (const line of csv) { if (!line.trim()) continue; const p = line.split(','); if (p[p.length - 1] === 'FILL_ZH') fillIds.add(Number(p[0])); }
  const ids = [...fillIds];
  const cur = (await client.query(`select count(*) f, count(*) filter (where n.translation_status='translated') z from track_music_sources e join music_source_nodes n on n.id=e.node_id`)).rows[0];
  const willZh = (await client.query(`select count(*) c from track_music_sources e where e.node_id = ANY($1::int[])`, [ids])).rows[0].c;
  console.log('FILL 节点数: ' + ids.length);
  console.log('当前边总数: ' + cur.f + ' | 当前指向中文: ' + cur.z + ' (' + (cur.z / cur.f * 100).toFixed(1) + '%)');
  console.log('补完后将新增"指向中文"的边: ' + willZh);
  console.log('补完后预计指向中文: ' + (Number(cur.z) + Number(willZh)) + ' / ' + cur.f + ' = ' + ((Number(cur.z) + Number(willZh)) / cur.f * 100).toFixed(1) + '%');
  const cov = (await client.query(`with s as (select e.track_id, bool_or(n.translation_status='translated') h from track_music_sources e join music_source_nodes n on n.id=e.node_id group by e.track_id) select count(*) c, count(*) filter (where h) z from s`)).rows[0];
  const cov2 = (await client.query(`with s as (select e.track_id, bool_or(n.translation_status='translated' or n.id = ANY($1::int[])) h from track_music_sources e join music_source_nodes n on n.id=e.node_id group by e.track_id) select count(*) c, count(*) filter (where h) z from s`, [ids])).rows[0];
  console.log('覆盖歌曲: 当前至少1中文地点 ' + cov.z + '/' + cov.c + ' -> 补完后 ' + cov2.z + '/' + cov2.c);
  await client.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
