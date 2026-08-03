const {Pool}=require('pg');require('dotenv').config();
const fs=require('fs');
const names=JSON.parse(fs.readFileSync('scripts/inst_filenames.json','utf8'));
function norm(s){return(s||'').toLowerCase().replace(/[（(].*?[)）]/g,'').replace(/[^a-z0-9\u4e00-\u9fff]/g,'').trim();}

(async()=>{
const pool=new Pool({host:process.env.DB_HOST,port:process.env.DB_PORT,user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME});
const {rows}=await pool.query('SELECT t.id,t.title,t.title_cn,t.lyrics_status,a.title as album FROM tracks t JOIN albums a ON a.id=t.album_id');

let matched=0,unmatched=0,ids=[];
for(const name of names){
  const n=norm(name);
  let m=rows.find(r=>norm(r.title)===n||norm(r.title_cn||'')===n);
  if(!m){const short=n.slice(0,12);m=rows.find(r=>norm(r.title).includes(short));}
  if(m){ids.push(m.id);matched++}
  else{unmatched++;if(unmatched<=10)console.log('unmatched:',name);}
}

console.log('Matched:',matched,'Unmatched:',unmatched);
const existing=rows.filter(r=>ids.includes(r.id)&&r.lyrics_status==='has').length;
console.log('Will UPDATE '+ids.length+' tracks to instrumental');
console.log('Currently has lyrics (will change):',existing);
console.log('=== DRY RUN — use --apply to execute ===');
fs.writeFileSync('scripts/inst_ids.json',JSON.stringify(ids));
pool.end();
})();
