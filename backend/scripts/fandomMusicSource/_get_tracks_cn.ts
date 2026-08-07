import { Client } from 'pg';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
dotenv.config({ path: require('path').resolve(__dirname, '../../.env') });
const client = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
async function main() {
  await client.connect();
  const r = (await client.query('select title_cn from tracks where title_cn is not null and title_cn <> \'\'')).rows;
  const set = new Set<string>(r.map((x:any)=>x.title_cn.trim()));
  fs.writeFileSync(__dirname + '/out/_tracks_cn.json', JSON.stringify([...set]));
  console.log('track title_cn count:', set.size);
  await client.end();
}
main().catch(e=>{console.error(e);process.exit(1);});
