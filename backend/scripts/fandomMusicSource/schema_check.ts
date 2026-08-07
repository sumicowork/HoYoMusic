import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const client = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
async function main(){
  await client.connect();
  const t = await client.query(`select table_name from information_schema.tables where table_name like '%track%' order by table_name`);
  console.log('track tables:', t.rows.map(r=>r.table_name).join(', '));
  for (const r of t.rows){
    const c = await client.query(`select column_name, data_type from information_schema.columns where table_name=$1 order by ordinal_position`,[r.table_name]);
    console.log(`\n-- ${r.table_name} --`);
    console.log(c.rows.map(x=>`${x.column_name}:${x.data_type}`).join(' | '));
  }
  await client.end();
}
main().catch(e=>{console.error(e);process.exit(1);});
