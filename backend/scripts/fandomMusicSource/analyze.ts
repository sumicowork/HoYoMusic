import fs from 'fs';
import path from 'path';

const ds = JSON.parse(fs.readFileSync(path.join(__dirname, 'out', 'music-source-dataset.json'), 'utf8'));

function analyze(name: string, game: any) {
  const tracks = game.tracks as any[];
  const total = tracks.length;
  const withLoc = tracks.filter((t) => (t.locations || []).some((l: any) => (l.enPath || []).length > 0));
  const emptyLoc = total - withLoc.length;
  const pending = tracks.filter((t) => (t.locations || []).some((l: any) => l.pending)).length;
  // depth distribution of enPath (only non-empty)
  const depth: Record<number, number> = {};
  let translatedSegs = 0, totalSegs = 0;
  for (const t of tracks) {
    for (const l of t.locations || []) {
      const ep = l.enPath || [];
      if (ep.length > 0) {
        depth[ep.length] = (depth[ep.length] || 0) + 1;
        for (let i = 0; i < ep.length; i++) {
          totalSegs++;
          const z = (l.zhPath || [])[i];
          if (z && z !== ep[i]) translatedSegs++;
        }
      }
    }
  }
  // HSR dirty during heuristic
  let dirty = 0, clean = 0;
  const dims: Record<string, number> = {};
  for (const t of tracks) {
    for (const l of t.locations || []) {
      if (l.dimension) dims[l.dimension] = (dims[l.dimension] || 0) + 1;
      for (const seg of l.enPath || []) {
        if (/\b(scene|trailer|dialogue|short|animated|event|combat|boss)\b/i.test(seg) || seg.length > 35) dirty++;
        else clean++;
      }
    }
  }
  console.log(`\n===== ${name} =====`);
  console.log(`tracks: ${total}`);
  console.log(`  with >=1 location: ${withLoc.length} (${((withLoc.length/total)*100).toFixed(1)}%)`);
  console.log(`  with NO location:  ${emptyLoc} (${((emptyLoc/total)*100).toFixed(1)}%)`);
  console.log(`  tracks w/ pending loc: ${pending} (${((pending/total)*100).toFixed(1)}%)`);
  console.log(`  location depth dist (enPath len):`, depth);
  console.log(`  dimension dist:`, dims);
  console.log(`  segment translation: ${translatedSegs}/${totalSegs} (${totalSegs?((translatedSegs/totalSegs)*100).toFixed(1):0}%)`);
  if (name === 'HSR') {
    console.log(`  HSR 'during' dirty(phrase/trailer/scene): ${dirty}, clean(short place): ${clean}`);
  }
  // sample a few tracks that HAVE locations
  console.log('  --- samples WITH locations ---');
  for (const t of withLoc.slice(0, 5)) {
    console.log(`   * ${t.trackTitle}`);
    for (const l of t.locations) {
      if ((l.enPath||[]).length) console.log(`       en=${JSON.stringify(l.enPath)} zh=${JSON.stringify(l.zhPath)} pending=${l.pending}`);
    }
  }
}

analyze('Genshin', ds.genshin);
analyze('HSR', ds.hsr);

// Check zh template leak in credits
let zhLeak = 0;
for (const t of ds.hsr.tracks) {
  for (const c of t.credits || []) {
    if (/\{\{zh/i.test(c.name)) zhLeak++;
  }
}
console.log('\nHSR credits with uncleaned {{zh}} template:', zhLeak);
