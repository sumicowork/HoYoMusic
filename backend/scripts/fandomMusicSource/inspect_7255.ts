import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const client = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
async function main(){
  await client.connect();
  // 1. the node itself
  const n = await client.query(`select id, game_id, category_id, parent_id, en_name, name, translation_status from music_source_nodes where id=7255`);
  console.log('=== node #7255 ===');
  console.log(JSON.stringify(n.rows[0], null, 2));
  // parent chain
  let pid = n.rows[0]?.parent_id;
  const chain:string[]=[];
  while(pid){
    const p = await client.query(`select id,parent_id,en_name,name from music_source_nodes where id=$1`,[pid]);
    if(!p.rows[0]) break;
    chain.push(`#${p.rows[0].id} ${p.rows[0].en_name} / ${p.rows[0].name}`);
    pid = p.rows[0].parent_id;
  }
  console.log('parent chain:', chain.join('  <-  '));
  // 2. is "门扉之启，王座之终" a track title?
  const t1 = await client.query(`select id,title_en,title_cn from tracks where title_cn = '门扉之启，王座之终' or title_cn like '%门扉之启%'`);
  console.log('\n=== tracks matching 门扉之启，王座之终 ===');
  console.log(JSON.stringify(t1.rows, null, 2));
  // 3. is there a track for the mission's expected theme? search Nemesis
  const t2 = await client.query(`select id,title_en,title_cn from tracks where title_en ilike '%nemesis%' or title_cn like '%涅墨西斯%'`);
  console.log('\n=== tracks matching Nemesis ===');
  console.log(JSON.stringify(t2.rows, null, 2));
  await client.end();
}
main().catch(e=>{console.error(e);process.exit(1);});
