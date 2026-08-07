const pg = require('pg');
const fs = require('fs');
const V13 = 'C:/Users/sumi/AppData/Local/Temp/hoyomusic_lrc_read/after_fix_v13.json';
const OUT = 'C:/Users/sumi/AppData/Local/Temp/hoyomusic_lrc_read';
function norm(s){return (s||'').toLowerCase().replace(/[「」『』（）().,、\s]+/g,' ').replace(/\s+/g,' ').trim();}
(async () => {
  const c = new pg.Client({host:'localhost',port:5432,user:'postgres',password:'2738744rcx',database:'hoyomusic_import'});
  await c.connect();
  const tr = await c.query('SELECT id,title,title_cn,title_en,album_id FROM tracks');
  const al = await c.query('SELECT id,title,title_cn,title_en,game_id FROM albums');
  await c.end();
  const tracks = tr.rows, albums = al.rows;
  const rawIdx = new Map(), normIdx = new Map();
  for (const t of tracks){
    for (const v of [t.title,t.title_cn,t.title_en]){
      if(!v) continue;
      if(!rawIdx.has(v)) rawIdx.set(v,[]); rawIdx.get(v).push(t);
      const n=norm(v); if(!normIdx.has(n)) normIdx.set(n,[]); normIdx.get(n).push(t);
    }
  }
  const aRaw=new Map(), aNorm=new Map();
  for(const a of albums){
    for(const v of [a.title,a.title_cn,a.title_en]){
      if(!v) continue;
      if(!aRaw.has(v)) aRaw.set(v,[]); aRaw.get(v).push(a);
      const n=norm(v); if(!aNorm.has(n)) aNorm.set(n,[]); aNorm.get(n).push(a);
    }
  }
  const data = JSON.parse(fs.readFileSync(V13,'utf8'));
  const files = data.length ? data : data.files;
  let total=0, matchedRaw=0, matchedNorm=0, unmatched=0;
  let scopedOK=0, albumMismatch=0, albumUnknown=0;
  const unmatchedList=[], mismatchList=[];
  for (const f of files){
    total++;
    const fp = f.file || f.filename || '';
    const segs = fp.split(/[\\/]/);
    const base = segs[segs.length-1].replace(/\.lrc$/i,'');
    const albumFolder = segs.length>=2 ? segs[segs.length-2] : '';
    let hits = rawIdx.get(base);
    let kind = 'raw';
    if(!hits){ hits = normIdx.get(norm(base)); kind='norm'; }
    if(!hits){ unmatched++; unmatchedList.push({file:fp, filename:base, albumFolder:albumFolder, reason:'filename 未命中任何 track.title'}); continue; }
    if(kind==='raw') matchedRaw++; else matchedNorm++;
    let aHits = aRaw.get(albumFolder);
    let aKind='raw';
    if(!aHits){ aHits = aNorm.get(norm(albumFolder)); aKind='norm'; }
    if(!aHits){ aHits=[]; }
    const aIds = new Set(aHits.map(a=>a.id));
    const inScope = hits.some(t=> aIds.has(t.album_id));
    if(aHits.length===0){ albumUnknown++; }
    else if(inScope){ scopedOK++; }
    else {
      albumMismatch++;
      const matchedAlbums = [...new Set(hits.map(t=>t.album_id))];
      mismatchList.push({file:fp, filename:base, albumFolder:albumFolder, matchedTrackAlbums:matchedAlbums, aMatch:aKind});
    }
  }
  console.log('=== 匹配预检结果 ===');
  console.log('LRC 总数:', total);
  console.log('轨道命中(精确 filename==title):', matchedRaw, ' | (归一后命中):', matchedNorm, ' | 未命中:', unmatched);
  console.log('命中率(轨道):', ((matchedRaw+matchedNorm)/total*100).toFixed(1)+'%');
  console.log('--- 专辑范围校验(仅对命中的):');
  console.log('  范围内一致(scopedOK):', scopedOK);
  console.log('  文件夹未映射到专辑(albumUnknown):', albumUnknown);
  console.log('  命中但不在文件夹所指专辑(mismatch):', albumMismatch);
  console.log('未命中文件数:', unmatchedList.length);
  fs.writeFileSync(OUT+'/unmatched_lrc.txt', unmatchedList.map(x=>'['+x.reason+']\n  '+x.file+'\n  filename='+x.filename+'  albumFolder='+x.albumFolder).join('\n')+'\n');
  fs.writeFileSync(OUT+'/album_mismatch.txt', mismatchList.map(x=>x.file+'\n  filename='+x.filename+'  albumFolder='+x.albumFolder+'  matchedTrackAlbums='+JSON.stringify(x.matchedTrackAlbums)+'  albumMatch='+x.aMatch).join('\n')+'\n');
  const uniqAlbFolders = [...new Set(files.map(f=>{const s=(f.file||'').split(/[\\/]/);return s.length>=2?s[s.length-2]:'';}))];
  const unresolved = uniqAlbFolders.filter(af=> !aRaw.has(af) && !aNorm.has(norm(af)) );
  fs.writeFileSync(OUT+'/album_unresolved_folders.txt', unresolved.join('\n')+'\n');
  console.log('\n已写出: unmatched_lrc.txt / album_mismatch.txt / album_unresolved_folders.txt');
  console.log('专辑文件夹去重总数:', uniqAlbFolders.length, ' | 其中未映射到 albums 表:', unresolved.length);
})();
