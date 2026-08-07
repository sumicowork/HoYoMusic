import fs from 'fs';
const ds = JSON.parse(fs.readFileSync(__dirname + '/out/music-source-dataset.json', 'utf8'));
const dbEn = fs.readFileSync(__dirname + '/out/db_title_en.txt', 'utf8')
  .split('\n').map((s) => s.trim().toLowerCase()).filter(Boolean);
const dbSet = new Set(dbEn);

function normStrict(s: string) {
  return s.toLowerCase().replace(/\s*\(soundtrack\)\s*$/i, '').replace(/\s+/g, ' ').trim();
}
function normLoose(s: string) {
  return normStrict(s)
    .replace(/\s*-\s*(instrumental|remix|tv size|short|extended|female version|male version).*$/i, '')
    .replace(/\s*feat\..*$/i, '')
    .replace(/['’",.!?;:]/g, '')
    .trim();
}

for (const game of ['genshin', 'hsr'] as const) {
  const fTitles = (ds[game].tracks as any[]).map((t) => String(t.pageTitle));
  const strictSet = new Set(fTitles.map(normStrict).filter(Boolean));
  const looseSet = new Set(fTitles.map(normLoose).filter(Boolean));

  const strictHit = [...strictSet].filter((x) => dbSet.has(x));
  const looseHit = [...looseSet].filter((x) => dbSet.has(x));

  console.log(`\n===== ${game} (matched against DB title_en) =====`);
  console.log(`fandom distinct pageTitles: ${strictSet.size} (loose ${looseSet.size}) | DB title_en: ${dbEn.length}`);
  console.log(`EXACT strict: ${strictHit.length}/${strictSet.size} = ${(strictHit.length / strictSet.size * 100).toFixed(1)}%`);
  console.log(`EXACT loose : ${looseHit.length}/${looseSet.size} = ${(looseHit.length / looseSet.size * 100).toFixed(1)}%`);
  console.log(`strict hits:`, strictHit.slice(0, 10).join(' | '));
  console.log(`fandom w/o hit:`, [...strictSet].filter((x) => !dbSet.has(x)).slice(0, 12).join(' | '));
}
const fAll = new Set([...ds.genshin.tracks, ...ds.hsr.tracks].map((t: any) => normStrict(String(t.pageTitle))).filter(Boolean));
const dbHit = dbEn.filter((d) => fAll.has(d));
console.log(`\nDB title_en matching ANY fandom page (strict): ${dbHit.length}/${dbEn.length} = ${(dbHit.length / dbEn.length * 100).toFixed(1)}%`);
console.log('sample DB hits:', dbHit.slice(0, 12).join(' | '));
