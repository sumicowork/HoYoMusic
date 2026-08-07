import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const client = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
async function main() {
  await client.connect();
  const cols = (await client.query(`select column_name, data_type, column_default, is_nullable from information_schema.columns where table_name='track_music_sources' order by ordinal_position`)).rows;
  console.log('=== track_music_sources columns ===');
  for (const c of cols) console.log(`  ${c.column_name}: ${c.data_type} | default=${c.column_default} | null=${c.is_nullable}`);
  const seq = (await client.query(`select pg_get_serial_sequence('track_music_sources','id') as s`)).rows[0];
  console.log('serial seq for id:', seq.s);
  await client.end();
}
main().catch(e=>{console.error(e);process.exit(1);});
