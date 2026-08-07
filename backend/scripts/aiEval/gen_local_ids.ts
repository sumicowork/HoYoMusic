import path from 'path';
import fs from 'fs';
import { listLrcFiles, matchTrackByFilename, fetchTracks } from './lib';
(async () => {
  const tracks = await fetchTracks(null);
  const lrcs = listLrcFiles('D:/CreditDebug');
  const ids = new Set<number>();
  const unmatched: string[] = [];
  for (const f of lrcs) {
    const t = matchTrackByFilename(path.basename(f), tracks);
    if (t) ids.add(t.id); else unmatched.push(path.basename(f));
  }
  fs.writeFileSync('C:/Users/sumi/AppData/Local/Temp/local_matched_ids.txt', [...ids].sort((a, b) => a - b).join('\n'));
  console.log('本地匹配唯一 track:', ids.size, '| 未匹配:', unmatched.length);
  for (const u of unmatched) console.log('  未匹配:', u);
})();
