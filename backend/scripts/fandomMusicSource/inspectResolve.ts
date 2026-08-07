import { getWikitext, parseOtherLanguages } from './fandomClient';

async function main() {
  const titles = ['Phantasmoon Courtyard', 'Dragon Mislay, Dreams Astray', 'Central Starskiff Haven'];
  for (const t of titles) {
    console.log(`\n========== ${t} ==========`);
    const wt = await getWikitext('honkai-star-rail', t);
    console.log('wikitext length:', wt.length);
    // show first 1200 chars
    console.log('--- head ---');
    console.log(wt.slice(0, 1200));
    // find template names
    const tmpls = [...wt.matchAll(/\{\{\s*([A-Za-z][A-Za-z ]*?)\s*[|\n]/g)].map((m) => m[1].trim());
    console.log('--- template names (first 20) ---');
    console.log([...new Set(tmpls)].slice(0, 20).join(' | '));
    // categories
    const cats = [...wt.matchAll(/\{\{\s*[Cc]ategory\s*:\s*([^|}\n]+)/g)].map((m) => m[1].trim());
    console.log('--- categories ---');
    console.log([...new Set(cats)].join(' | '));
    // any region/planet/location/area field
    const fieldHits = wt.match(/\|\s*(region|planet|location|area|zone|system|world|realm)\s*=\s*[^|\n]+/gi);
    console.log('--- location-ish fields ---');
    console.log(fieldHits ? fieldHits.join(' | ') : '(none)');
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
