import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const client = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
async function main() {
  await client.connect();
  const cols = (await client.query(`select column_name, data_type, is_nullable from information_schema.columns where table_name='track_music_sources' order by ordinal_position`)).rows;
  console.log('=== track_music_sources columns ===');
  for (const c of cols) console.log(`  ${c.column_name}: ${c.data_type} (null=${c.is_nullable})`);
  // any existing FKs / indexes?
  const fk = (await client.query(`select conname, pg_get_constraintdef(oid) as def from pg_constraint where conrelid='track_music_sources'::regclass`)).rows;
  console.log('=== constraints ===');
  for (const c of fk) console.log(`  ${c.conname}: ${c.def}`);
  await client.end();
}
main().catch(e=>{console.error(e);process.exit(1);});
