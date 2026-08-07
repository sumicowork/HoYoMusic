import * as fs from 'fs';
import * as path from 'path';
const ds = JSON.parse(fs.readFileSync(path.resolve(__dirname,'out/music-source-dataset.json'),'utf8'));
console.log('top keys:', Object.keys(ds));
for(const k of Object.keys(ds)){
  const v = (ds as any)[k];
  console.log(k, '->', Array.isArray(v)? 'array len '+v.length : typeof v);
}
// find the array of tracks
for(const k of Object.keys(ds)){
  const v=(ds as any)[k];
  if(Array.isArray(v) && v.length){
    console.log('\nsample of',k,':');
    console.log(JSON.stringify(v[0],null,2).slice(0,600));
    break;
  }
}
