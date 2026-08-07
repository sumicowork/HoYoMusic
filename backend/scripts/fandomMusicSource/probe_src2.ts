import * as fs from 'fs';
import * as path from 'path';
const ds = JSON.parse(fs.readFileSync(path.resolve(__dirname,'out/music-source-dataset.json'),'utf8'));
const hsr = ds.hsr;
console.log('hsr keys:', Object.keys(hsr));
const tracks = hsr.tracks||hsr.items||[];
console.log('hsr tracks:', tracks.length);
let found=0;
for(const e of tracks){
  const s = JSON.stringify(e);
  if(s.includes('Nemesis, Scorched by Golden Blood')){
    found++;
    console.log('\n--- HSR track hit ---');
    console.log('title_en:', e.title_en||e.titleEn||e.title);
    console.log('title_zh:', e.trackTitle||e.title_zh||e.titleZh);
    console.log(JSON.stringify(e,null,2).slice(0,900));
    if(found>=2) break;
  }
}
if(!found) console.log('(not found in hsr.tracks)');
