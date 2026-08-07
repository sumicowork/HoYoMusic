import { Client } from 'pg';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const client = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
async function main(){
  await client.connect();
  const tr = await client.query(`select title_cn from tracks where title_cn is not null and title_cn<>''`);
  const titleCn = new Set<string>(tr.rows.map(r=>r.title_cn));
  const g = await client.query(`select id,en_name,name from music_source_nodes where game_id=1 and translation_status='translated'`);
  const gbugs = g.rows.filter(r=>titleCn.has(r.name));
  console.log('Genshin translated nodes:', g.rows.length, '| name===track title_cn:', gbugs.length);
  for(const b of gbugs.slice(0,15)) console.log(`  #${b.id} ${b.name} <= ${b.en_name}`);
  await client.end();
}
main().catch(e=>{console.error(e);process.exit(1);});
