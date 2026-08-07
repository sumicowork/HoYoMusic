import fs from 'fs';
import { getWikitext } from './fandomClient';
const dbTitles = new Set(fs.readFileSync(__dirname + '/out/db_titles.txt', 'utf8').split('\n').map((s) => s.trim().toLowerCase()).filter(Boolean));

function extractTracklist(wt: string): string[] {
  const out: string[] = [];
  // Genshin OST pages often use a numbered list or a table under ==Tracklist== / ==Track list==
  const sec = wt.match(/==+\s*(?:Track\s*list|Tracklist|Tracks)\s*==+([\s\S]*?)(==+\s*\w|$)/i);
  const body = sec ? sec[1] : wt;
  // numbered list items: # Track Name
  for (const m of body.matchAll(/^\s*#\s*([^\n#|{}]+)/gm)) {
    const name = m[1].replace(/\[\[|\]\]|{{[^}]*}}|'''?/g, '').trim();
    if (name) out.push(name);
  }
  // Also {{Tracklist|track1=...}} style
  const tl = wt.match(/\{\{\s*Tracklist\s*\|([\s\S]*?)\}\}/i);
  if (tl) for (const m of tl[1].matchAll(/\|\s*(?:track\d+|name\d+)\s*=\s*([^\n|{}]+)/gi)) out.push(m[1].trim());
  return out;
}

(async () => {
  const page = 'Akasha Pulses, the Kalpa Flame Rises (Soundtrack)';
  const wt = await getWikitext('genshin-impact', page);
  const list = extractTracklist(wt);
  console.log(`page: ${page}`);
  console.log(`extracted tracklist entries: ${list.length}`);
  let matched = 0;
  for (const t of list.slice(0, 25)) {
    const hit = dbTitles.has(t.toLowerCase().trim());
    if (hit) matched++;
    console.log(`  ${hit ? '✓' : '·'} ${t}`);
  }
  console.log(`\nmatched to DB (first 25): ${matched}/25`);
  console.log('total distinct extracted:', new Set(list.map((t) => t.toLowerCase())).size);
})().catch((e) => { console.error(e); process.exit(1); });
