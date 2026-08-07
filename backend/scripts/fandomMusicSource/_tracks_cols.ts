import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const client = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
async function main() {
  await client.connect();
  const cols = (await client.query(`select column_name, data_type from information_schema.columns where table_name='tracks' order by ordinal_position`)).rows;
  console.log('=== tracks columns ===');
  for (const c of cols) console.log(`  ${c.column_name}: ${c.data_type}`);
  // sample a row
  const r = (await client.query(`select * from tracks limit 1`)).rows[0];
  console.log('\n=== sample row keys ===');
  console.log(Object.keys(r).join(', '));
  await client.end();
}
main().catch(e=>{console.error(e);process.exit(1);});
