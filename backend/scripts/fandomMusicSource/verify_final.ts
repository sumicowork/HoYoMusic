import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const client = new Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function main() {
  await client.connect();
  try {
    // 1) Backup tables exist
    const bak = await client.query(`
      select table_name from information_schema.tables
      where table_schema='public' and table_name like '%_bak_%'
      order by table_name
    `);
    console.log('=== BACKUP TABLES ===');
    console.log(bak.rows.map((r: any) => r.table_name).join('\n') || '(none)');
    console.log('');

    // 2) Node counts by game + translation_status
    const counts = await client.query(`
      select g.name as game, n.translation_status, count(*) as cnt
      from music_source_nodes n
      join games g on g.id = n.game_id
      group by g.name, n.translation_status
      order by g.name, n.translation_status
    `);
    console.log('=== NODE COUNTS BY GAME/STATUS ===');
    for (const r of counts.rows) {
      console.log(`${r.game}\t${r.translation_status}\t${r.cnt}`);
    }
    const total = await client.query(`select count(*) as c from music_source_nodes`);
    console.log(`TOTAL nodes: ${total.rows[0].c}`);
    console.log('');

    // 3) Categories
    const cats = await client.query(`
      select g.name as game, c.name, c.en_name, c.translation_status
      from music_source_categories c
      join games g on g.id = c.game_id
      order by g.name, c.id
    `);
    console.log('=== CATEGORIES ===');
    for (const r of cats.rows) {
      console.log(`${r.game}\t${r.name}\t| en=${r.en_name ?? ''}\t[${r.translation_status}]`);
    }
    console.log('');

    // 4) Leakage check: CJK or URL inside en_name, or URL inside name
    const leak = await client.query(`
      select id, game_id, name, en_name
      from music_source_nodes
      where en_name ~ '[一-鿿]' or en_name like '%http%' or en_name like '%/%'
         or name like '%http%'
      limit 30
    `);
    console.log('=== LEAKAGE CHECK (CJK/URL in en_name or URL in name) ===');
    console.log(leak.rows.length ? leak.rows.map((r: any) => `id=${r.id} game=${r.game_id} name=${JSON.stringify(r.name)} en_name=${JSON.stringify(r.en_name)}`).join('\n') : 'NONE — clean');
    console.log('');

    // 5) Sample translated vs pending nodes
    const sampleTrans = await client.query(`
      select g.name as game, n.name, n.en_name
      from music_source_nodes n join games g on g.id=n.game_id
      where n.translation_status='translated'
      order by random() limit 6
    `);
    console.log('=== SAMPLE TRANSLATED ===');
    for (const r of sampleTrans.rows) console.log(`${r.game}\t${r.en_name}\t→\t${r.name}`);
    console.log('');

    const samplePend = await client.query(`
      select g.name as game, n.name, n.en_name
      from music_source_nodes n join games g on g.id=n.game_id
      where n.translation_status='pending'
      order by random() limit 6
    `);
    console.log('=== SAMPLE PENDING ===');
    for (const r of samplePend.rows) console.log(`${r.game}\t${r.en_name}\t(pending)`);
    console.log('');

    // 6) track_music_sources linkage
    const tms = await client.query(`select count(*) as c from track_music_sources`);
    console.log(`=== track_music_sources rows: ${tms.rows[0].c} ===`);
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
