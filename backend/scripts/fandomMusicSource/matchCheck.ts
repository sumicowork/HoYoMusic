import fs from 'fs';
const ds = JSON.parse(fs.readFileSync(__dirname + '/out/music-source-dataset.json', 'utf8'));
const dbTitles = fs.readFileSync(__dirname + '/out/db_titles.txt', 'utf8').split('\n').map((s) => s.trim().toLowerCase()).filter(Boolean);
const dbSet = new Set(dbTitles);

console.log('--- 10 fandom Genshin pageTitles ---');
console.log((ds.genshin.tracks as any[]).slice(0, 10).map((t) => t.pageTitle).join('\n'));
console.log('\n--- 10 DB titles ---');
console.log(dbTitles.slice(0, 10).join('\n'));

const fTitles = (ds.genshin.tracks as any[]).map((t) => String(t.pageTitle).toLowerCase().trim()).filter(Boolean);

// contains / token-overlap fuzzy
let contains = 0; // fandom title is contained in some db title (or vice versa)
let tokenOverlap = 0;
function toks(s: string) { return new Set(s.split(/[^a-z0-9一-鿿]+/i).filter((w) => w.length >= 3)); }
for (const f of fTitles) {
  if (dbTitles.some((d) => d.includes(f) && f.length > 3)) { contains++; continue; }
  if (dbTitles.some((d) => d.length > 3 && f.includes(d))) { contains++; continue; }
  const ft = toks(f);
  if ([...ft].some((w) => dbTitles.some((d) => d.includes(w)))) tokenOverlap++;
}
console.log(`\ncontains(either direction): ${contains}/${fTitles.length} (${(contains / fTitles.length * 100).toFixed(1)}%)`);
console.log(`token-substring overlap: ${tokenOverlap}/${fTitles.length} (${(tokenOverlap / fTitles.length * 100).toFixed(1)}%)`);

// Which DB tracks are Genshin? No game col. Check albums.
console.log('\n--- does fandom title "doom bloom"/"peak"/"defeat" exist in DB? ---');
for (const q of ['doom bloom', 'peak', 'defeat', 'choice', 'enjoy the ride']) {
  console.log(`  ${q}: ${dbSet.has(q) ? 'YES' : 'no'} | db contains: ${dbTitles.filter((d) => d.includes(q)).slice(0, 3)}`);
}
console.log('\n--- does DB title "wind and star"/"liyue"/"mondstadt" exist in fandom? ---');
for (const q of ['wind and star', 'liyue', 'mondstadt', 'genshin']) {
  console.log(`  ${q}: fandom has ${fTitles.filter((d) => d.includes(q)).length} pages`);
}
