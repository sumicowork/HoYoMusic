import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const client = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
async function main(){
  await client.connect();
  // build track title_cn set
  const tr = await client.query(`select title_cn from tracks where title_cn is not null and title_cn<>''`);
  const titleCn = new Set<string>(tr.rows.map(r=>r.title_cn));
  // all HSR translated nodes whose name equals a track title_cn (= the "song name mis-planted" class)
  const n = await client.query(`select id, en_name, name from music_source_nodes where game_id=2 and translation_status='translated'`);
  const bugs = n.rows.filter(r=>titleCn.has(r.name));
  console.log('HSR translated nodes:', n.rows.length);
  console.log('name === some track title_cn (song-name-misplant class):', bugs.length);
  // how many have dirty template junk in en_name
  const junk = bugs.filter(r=>/[|]|showChapter|=0|Mission\||Login|Menu/i.test(r.en_name));
  console.log('  of those, en_name still carries template junk:', junk.length);
  console.log('\n--- full list ---');
  for(const b of bugs) console.log(`#${b.id}  ${b.name}   <=  ${b.en_name}`);
  await client.end();
}
main().catch(e=>{console.error(e);process.exit(1);});
