import { getWikitext, parseOtherLanguages, apiGet } from './fandomClient';
import { parseInfobox } from './adapters/parse';

async function main() {
  const title = 'Central Starskiff Haven';
  const wt = await getWikitext('honkai-star-rail', title);
  console.log('wikitext len', wt.length);
  for (const n of ['Location Infobox', 'Location', 'Area Infobox', 'Mission Infobox']) {
    const ib = parseInfobox(wt, n);
    console.log(`\n--- parseInfobox('${n}') keys:`, Object.keys(ib));
    if (Object.keys(ib).length) {
      for (const f of ['world', 'region', 'area', 'subarea', 'location', 'connections', 'type']) {
        if (ib[f] !== undefined) console.log(`   ${f} = ${JSON.stringify(ib[f].slice(0, 60))}`);
      }
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
