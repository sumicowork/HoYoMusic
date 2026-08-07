import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const client = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
async function main() {
  await client.connect();
  const cols = (await client.query(`select column_name from information_schema.columns where table_name='albums' order by ordinal_position`)).rows.map((c:any)=>c.column_name);
  console.log('albums cols:', cols.join(', '));
  const r = (await client.query(`select * from albums limit 1`)).rows[0];
  console.log('sample:', Object.fromEntries(Object.entries(r).map(([k,v])=>[k, String(v).slice(0,40)])));
  await client.end();
}
main().catch(e=>{console.error(e);process.exit(1);});
