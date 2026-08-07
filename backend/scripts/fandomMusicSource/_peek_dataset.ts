import * as fs from 'fs';
import * as path from 'path';
const f = path.resolve(__dirname, 'out/music-source-dataset.json');
const data = JSON.parse(fs.readFileSync(f, 'utf8'));
for (const g of ['genshin', 'hsr']) {
  const tracks = data[g].tracks as any[];
  console.log('\n========== ' + g + ' tracks: ' + tracks.length + ' ==========');
  const t = tracks[0];
  console.log('keys:', Object.keys(t).join(', '));
  for (const lk of ['title_en', 'titleEn', 'game', 'gameId', 'locations', 'musicSource', 'sources', 'music_sources', 'resolved', 'category', 'resolvedPath', 'resolvedZhPath', 'path', 'enPath', 'zhPath']) {
    if (t[lk] !== undefined) {
      const lv = t[lk];
      if (Array.isArray(lv)) console.log('  .' + lk + ': array[' + lv.length + ']');
      else if (typeof lv === 'object' && lv) console.log('  .' + lk + ': object keys=' + Object.keys(lv).join(','));
      else console.log('  .' + lk + ': ' + JSON.stringify(lv).slice(0, 120));
    }
  }
  // print a fuller sample of track[0]
  console.log('\n--- sample track[0] ---');
  console.log(JSON.stringify(t, null, 1).slice(0, 1500));
}
