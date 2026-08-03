const {Pool}=require('pg');require('dotenv').config();
const fs=require('fs');
const names=JSON.parse(fs.readFileSync('scripts/inst_final.json','utf8'));
function norm(s){return(s||'').toLowerCase().replace(/[（(].*?[)）]/g,'').replace(/[^a-z0-9\u4e00-\u9fff]/g,'').trim();}

(async()=>{
const pool=new Pool({host:process.env.DB_HOST,port:process.env.DB_PORT,user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME});
const {rows}=await pool.query('SELECT t.id,t.title,t.title_cn,t.lyrics_status,a.title as album FROM tracks t JOIN albums a ON a.id=t.album_id');

let matched=0,ids=[];
for(const name of names){
  const n=norm(name);
  let m=rows.find(r=>norm(r.title)===n||norm(r.title_cn||'')===n);
  if(!m){const short=n.slice(0,15);m=rows.find(r=>norm(r.title).includes(short));}
  if(m){ids.push(m.id);matched++}
}
console.log('Matched:',matched,'/',names.length);

const client=await pool.connect();
try{
  await client.query('BEGIN');
  const r=await client.query('UPDATE tracks SET lyrics_status=$1 WHERE id=ANY($2::int[])',['instrumental',ids]);
  await client.query('COMMIT');
  console.log('UPDATED',r.rowCount,'tracks to instrumental');
}catch(e){
  await client.query('ROLLBACK');
  console.error('ERROR:',e.message);
}finally{client.release();}
pool.end();
})();
