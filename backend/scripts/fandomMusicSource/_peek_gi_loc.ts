import * as fs from 'fs';
import * as path from 'path';
const data = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'out/music-source-dataset.json'), 'utf8'));
const t = data.genshin.tracks[0];
console.log('genshin track[0] keys:', Object.keys(t).join(', '));
console.log('title_en-ish:', t.otherLanguages?.en || t.pageTitle);
console.log('\nfirst 3 locations of track[0]:');
for (const l of (t.locations || []).slice(0, 3)) {
  console.log('  keys:', Object.keys(l).join(', '));
  console.log('  ' + JSON.stringify(l).slice(0, 400));
}
// find a location that looks "resolved" (has enName or category)
let found = null;
for (const t2 of data.genshin.tracks) {
  for (const l of (t2.locations || [])) {
    const ks = Object.keys(l);
    if (ks.includes('enName') || ks.includes('category') || ks.includes('dimension') || ks.includes('nodeId')) { found = l; break; }
  }
  if (found) break;
}
if (found) { console.log('\nlocation with extra keys:', JSON.stringify(found).slice(0, 500)); }
else console.log('\nno location has enName/category/dimension/nodeId keys');
