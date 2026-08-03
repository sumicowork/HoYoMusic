const {Pool}=require('pg');require('dotenv').config();
const fs=require('fs');
const names=JSON.parse(fs.readFileSync('scripts/inst_complete.json','utf8'));
function norm(s){return(s||'').toLowerCase().replace(/[（(].*?[)）]/g,'').replace(/[^a-z0-9\u4e00-\u9fff]/g,'').trim();}
(async()=>{
const pool=new Pool({host:process.env.DB_HOST,port:process.env.DB_PORT,user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME});
// 回滚
await pool.query('UPDATE tracks SET lyrics_status=chr(110)||chr(111)||chr(110)||chr(101) WHERE lyrics_status=chr(105)||chr(110)||chr(115)||chr(116)||chr(114)||chr(117)||chr(109)||chr(101)||chr(110)||chr(116)||chr(97)||chr(108)');
// 匹配
const {rows}=await pool.query('SELECT t.id,t.title,t.title_cn FROM tracks t');
let ids=[];
for(const name of names){const n=norm(name);let m=rows.find(r=>norm(r.title)===n||norm(r.title_cn||'')===n);if(!m){const short=n.slice(0,15);m=rows.find(r=>norm(r.title).includes(short));}if(m)ids.push(m.id);}
console.log('Matched:',ids.length,'/',names.length);
const r=await pool.query({text:'UPDATE tracks SET lyrics_status=$1 WHERE id=ANY($2::int[])',values:['instrumental',ids]});
console.log('UPDATED',r.rowCount,'tracks');
const s=await pool.query('SELECT lyrics_status,count(*) FROM tracks GROUP BY 1 ORDER BY 2 DESC');
s.rows.forEach(rr=>console.log(rr.lyrics_status,rr.count));
pool.end();
})();
