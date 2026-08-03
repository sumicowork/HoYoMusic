const {Pool}=require('pg');require('dotenv').config();
const fs=require('fs');
const names=JSON.parse(fs.readFileSync('scripts/inst_agent_only.json','utf8'));
function norm(s){return(s||'').toLowerCase().replace(/[（(].*?[)）]/g,'').replace(/[^a-z0-9\u4e00-\u9fff]/g,'').trim();}

(async()=>{
const pool=new Pool({host:process.env.DB_HOST,port:process.env.DB_PORT,user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME});
const {rows}=await pool.query('SELECT t.id,t.title,t.title_cn FROM tracks t');
let ids=[];
for(const name of names){
  const n=norm(name);
  let m=rows.find(r=>norm(r.title)===n||norm(r.title_cn||'')===n);
  if(!m){const short=n.slice(0,15);m=rows.find(r=>norm(r.title).includes(short));}
  if(m)ids.push(m.id);
}
console.log('Matched:',ids.length,'/',names.length);
const client=await pool.connect();
try{
  await client.query('BEGIN');
  const r=await client.query('UPDATE tracks SET lyrics_status = chr(36)||chr(49) WHERE id=ANY(chr(36)||chr(50)::int[])',['instrumental',ids]);
  console.log('UPDATED',r.rowCount,'tracks');
  await client.query('COMMIT');
}catch(e){
  await client.query('ROLLBACK');
  console.error('ERROR:',e.message);
  // fallback: direct parameterized
  try{
    await client.query('BEGIN');
    const r=await client.query({text:'UPDATE tracks SET lyrics_status=$1 WHERE id=ANY($2::int[])',values:['instrumental',ids]});
    console.log('FALLBACK UPDATED',r.rowCount,'tracks');
    await client.query('COMMIT');
  }catch(e2){
    await client.query('ROLLBACK');
    console.error('FALLBACK ERROR:',e2.message);
  }
}
finally{client.release();}
pool.end();
})();
