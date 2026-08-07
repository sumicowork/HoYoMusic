import * as fs from 'fs';
import * as path from 'path';
const ds = JSON.parse(fs.readFileSync(path.resolve(__dirname,'out/music-source-dataset.json'),'utf8'));
const arr = Array.isArray(ds)? ds : (ds.tracks||ds.items||[]);
console.log('dataset entries:', arr.length);
let found=0;
for(const e of arr){
  const s = JSON.stringify(e);
  if(s.includes('Nemesis, Scorched by Golden Blood')){
    found++;
    console.log('--- entry hit ---');
    console.log('title_en:', e.title_en||e.titleEn||e.title);
    console.log('title_zh:', e.title_zh||e.trackTitle||e.titleZh);
    console.log('sources/during:', JSON.stringify(e.sources||e.during||e.locations||e.musicSources||[]).slice(0,400));
    if(found>=3) break;
  }
}
if(!found) console.log('(no dataset entry contains that during string)');
