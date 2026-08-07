import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const CACHE = path.resolve(__dirname, '.cache');
const cacheByTitle = new Map<string,{title:string;wt:string}>();
for(const f of fs.readdirSync(CACHE).filter(x=>x.endsWith('.json'))){let d:any;try{d=JSON.parse(fs.readFileSync(path.join(CACHE,f),'utf8'));}catch{continue;}const p=d?.parse;if(!p||!p.title)continue;cacheByTitle.set(p.title.toLowerCase(),{title:p.title,wt:p.wikitext?.['*']||''});}
function isSound(t:string,w:string){return /soundtrack/i.test(t)||/{{Soundtrack Infobox/i.test(w);}
function pagesZh(zh:string){let ns=0,ss=0;for(const v of cacheByTitle.values()){const m=v.wt.match(/{{Other Languages([\s\S]*?)}}/i);if(!m)continue;const o:Record<string,string>={};for(const l of m[1].split(/\n/)){const mm=l.match(/^\s*\|?\s*([a-z0-9_]+)\s*=\s*(.+?)\s*$/i);if(mm){o[mm[1].toLowerCase().replace(/^\d+_/,'')]=mm[2].replace(/{{[^}]*}}/g,'').trim();}}if(o.zhs===zh||o.zht===zh){if(isSound(v.title,v.wt))ss++;else ns++;}}return{ns,ss};}
const client=new Client({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD});
async function main(){await client.connect();
  const c=await client.query(`select translation_status, count(*) c from music_source_nodes where game_id=2 group by translation_status`);
  console.log('HSR status after fix:', JSON.stringify(c.rows));
  const b=await client.query(`select table_name from information_schema.tables where table_name like '%bugfix_bak%' order by table_name`);
  console.log('backup tables:', b.rows.map(r=>r.table_name).join(', '));
  // re-scan: any translated HSR node whose zh is ONLY from soundtrack pages?
  const all=await client.query(`select id,en_name,name,translation_status from music_source_nodes where game_id=2 and translation_status='translated'`);
  let residual=0;const bad:string[]=[];
  for(const r of all.rows){const {ns,ss}=pagesZh(r.name);if(ss>0 && ns===0){residual++;if(bad.length<10)bad.push(`#${r.id} ${r.name}`);}}
  console.log('residual TRUE-BUG (translated but zh only from soundtrack):', residual, bad.join(' | '));
  await client.end();
}
main().catch(e=>{console.error(e);process.exit(1);});
