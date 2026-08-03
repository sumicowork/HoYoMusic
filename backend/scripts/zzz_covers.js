const https = require('https');
const OSS = require('ali-oss');
const { Client } = require('pg');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '/opt/hoyomusic/.env' });

const oss = new OSS({region:process.env.OSS_REGION,accessKeyId:process.env.OSS_ACCESS_KEY_ID,accessKeySecret:process.env.OSS_ACCESS_KEY_SECRET,bucket:process.env.OSS_BUCKET,secure:true});
const db = new Client({host:process.env.DB_HOST,port:process.env.DB_PORT,user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME});
const cacheRoot = process.env.REMOTE_RESOURCE_CACHE_DIR || path.join(process.cwd(), 'uploads/cache/remote');

function lookup(id) {
  return new Promise(r => {
    https.get('https://itunes.apple.com/lookup?id='+id+'&country=cn', res=>{
      let d=''; res.on('data',c=>d+=c); res.on('end',()=>{try{const j=JSON.parse(d);r(j.results[0]||null)}catch{r(null)}});
    }).on('error',()=>r(null));
  });
}
function dl(u) {
  return new Promise(r=>{
    https.get(u.replace('100x100bb','3000x3000bb'), res=>{
      let b=[]; res.on('data',c=>b.push(c)); res.on('end',()=>{r(Buffer.concat(b))});
    }).on('error',()=>r(null));
  });
}
function clearCache(url) {
  ['thumb','origin'].forEach(v=>{
    try{
      const ck='cover:'+url+':'+v;
      const h=crypto.createHash('sha1').update(ck).digest('hex');
      fs.unlinkSync(path.join(cacheRoot,'covers',h.slice(0,2),h+'.bin'));
    }catch(e){}
  });
}

(async()=>{
  await db.connect();
  for (const t of [
    {aid:155, appleId:'6786665445', label:'预言 Prophecy'},
    {aid:156, appleId:'1887462636', label:'妄想色心跳'},
    {aid:157, appleId:'6788244160', label:'chaos.exe'},
  ]) {
    const a = await lookup(t.appleId);
    if (!a) { console.log(t.label+': not found'); continue; }
    console.log(t.label+':', a.collectionName||a.trackName);
    const buf = await dl(a.artworkUrl100);
    if (!buf) { console.log('  download failed'); continue; }
    const key = 'hoyomusic/covers/album_'+t.aid+'.jpg';
    await oss.put(key, buf, {mime:'image/jpeg'});
    const url = 'https://'+process.env.OSS_BUCKET+'.'+process.env.OSS_REGION+'.aliyuncs.com/'+key;
    await db.query('UPDATE albums SET cover_path=$1 WHERE id=$2', [url, t.aid]);
    clearCache(url);
    console.log('  '+(buf.length/1024).toFixed(0)+'KB OK');
  }
  await db.end();
  console.log('Done');
})();
