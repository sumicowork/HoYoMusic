import * as fs from 'fs';
import * as path from 'path';
const ds = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'out/music-source-dataset.json'), 'utf8'));
const arr = Array.isArray(ds) ? ds : (ds.tracks || ds.items || []);
console.log('total dataset entries:', arr.length);
// inspect game field across a few entries
const sample = arr.slice(0, 3);
for (const t of sample) {
  console.log('--- entry keys:', Object.keys(t).join(', '));
  console.log('   gameId=', t.gameId, ' game_id=', t.game_id, ' game=', t.game);
  console.log('   title_en=', t.title_en, ' title=', t.title);
}
// distinct game field values
const gk = new Set(arr.map((t:any)=> t.gameId ?? t.game_id ?? t.game ?? 'NONE'));
console.log('\ndistinct game-key values:', [...gk].join(', '));
