import * as fs from 'fs';
import * as path from 'path';
const ds = JSON.parse(fs.readFileSync(path.resolve(__dirname,'out/music-source-dataset.json'),'utf8'));
for(const e of ds.hsr.tracks){
  for(const loc of (e.locations||[])){
    if(String(loc.entity||'').includes('Nemesis, Scorched by Golden Blood')){
      console.log('track:', e.trackTitle, '(',e.pageTitle,')');
      console.log('  method:', loc.method);
      console.log('  note  :', loc.note);
      console.log('  resolvedZhPath:', JSON.stringify(loc.resolvedZhPath));
    }
  }
}
