import * as fs from 'fs';
import * as path from 'path';
const data = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'out/music-source-dataset.json'), 'utf8'));
for (const g of ['genshin', 'hsr']) {
  const tracks = data[g].tracks as any[];
  let withLocs = 0, totalLocs = 0, locsResolved = 0, locsPending = 0, locsEmptyPath = 0, locsNoKind = 0, kindSet = new Set<string>();
  for (const t of tracks) {
    const locs = t.locations || [];
    if (locs.length) withLocs++;
    for (const l of locs) {
      totalLocs++;
      if (l.kind) kindSet.add(l.kind); else locsNoKind++;
      if (l.resolvedPath && l.resolvedPath.length) locsResolved++; else locsEmptyPath++;
      if (l.pending) locsPending++;
    }
  }
  console.log(`\n===== ${g} =====`);
  console.log(`tracks: ${tracks.length}`);
  console.log(`  with ≥1 location: ${withLocs}`);
  console.log(`  total locations: ${totalLocs}`);
  console.log(`    resolvedPath 非空: ${locsResolved}`);
  console.log(`    resolvedPath 空:   ${locsEmptyPath}`);
  console.log(`    pending=true:       ${locsPending}`);
  console.log(`    no kind field:     ${locsNoKind}`);
  console.log(`  kinds seen: ${[...kindSet].join(', ')}`);
}
