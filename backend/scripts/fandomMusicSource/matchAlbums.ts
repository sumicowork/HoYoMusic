import fs from 'fs';
const ds = JSON.parse(fs.readFileSync(__dirname + '/out/music-source-dataset.json', 'utf8'));
const dbAlbums = fs.readFileSync(__dirname + '/out/db_albums.txt', 'utf8').split('\n').map((s) => s.trim().toLowerCase()).filter(Boolean);

function matchRate(label: string, fandomAlbums: string[]) {
  let exact = 0, embedded = 0;
  const misses: string[] = [];
  for (const fa of fandomAlbums) {
    const f = fa.toLowerCase().trim();
    if (dbAlbums.includes(f)) { exact++; continue; }
    // our DB album titles embed English after the 原神- prefix; check if fandom name is a substring
    if (dbAlbums.some((d) => d.includes(f))) { embedded++; continue; }
    misses.push(fa);
  }
  console.log(`${label}: ${fandomAlbums.length} fandom albums | exact ${exact} | embedded-substr ${embedded} | total ${exact + embedded} (${(100 * (exact + embedded) / fandomAlbums.length).toFixed(1)}%)`);
  if (misses.length) console.log('  misses:', misses.slice(0, 12).join(' | '));
}

matchRate('Genshin', ds.genshin.albums.map((a: any) => a.title));
matchRate('HSR', ds.hsr.albums.map((a: any) => a.title));
