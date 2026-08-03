/* 逻辑备份 music_source 三张表（game_id=1），输出可还原的 .sql INSERT 文件。
 * 用 node pg 客户端（本环境 libpq/pg_dump 连不上，但 node 能连）。
 * 还原：psql 里先 TRUNCATE track_music_sources, music_source_nodes, music_source_categories CASCADE; 再 \i 此文件。
 */
require('dotenv').config({ path: '.env' });
const fs = require('fs');
const { Client } = require('pg');

const TABLES = [
  { name: 'music_source_categories', where: 'game_id=1' },
  { name: 'music_source_nodes', where: 'game_id=1' },
  { name: 'track_music_sources', where: 'node_id IN (SELECT id FROM music_source_nodes WHERE game_id=1)' },
];

function esc(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  // string / uuid / timestamp
  return `'${String(v).replace(/'/g, "''")}'`;
}

(async () => {
  const c = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.DB_USER, password: String(process.env.DB_PASSWORD) });
  await c.connect();
  const TS = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const out = [`-- HoYoMusic music_source backup (game_id=1) generated ${TS}`,
    '-- Restore: TRUNCATE track_music_sources, music_source_nodes, music_source_categories CASCADE; then \\i this file',
    ''];
  const counts = {};
  for (const t of TABLES) {
    const cols = await c.query('SELECT column_name FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position', [t.name]);
    const colList = cols.rows.map((r) => r.column_name);
    const rows = await c.query(`SELECT * FROM ${t.name} WHERE ${t.where} ORDER BY id`);
    counts[t.name] = rows.rows.length;
    out.push(`-- ${t.name}: ${rows.rows.length} rows`);
    out.push(`INSERT INTO ${t.name} (${colList.join(', ')}) VALUES`);
    const tuples = rows.rows.map((r) => `  (${colList.map((col) => esc(r[col])).join(', ')})`);
    out.push(tuples.join(',\n') + ';');
    out.push('');
  }
  const file = `db/backups/music_source_pre_cleanup_${TS}.sql`;
  fs.writeFileSync(file, out.join('\n'));
  console.log('备份完成 ->', file);
  console.log('记录数:', JSON.stringify(counts));
  await c.end();
})().catch((e) => { console.error('ERR', e); process.exit(1); });
