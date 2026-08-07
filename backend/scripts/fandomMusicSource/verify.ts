import { getWikitext, getCategoryMembers } from './fandomClient';
import { parseSoundtrackUsageLocations } from './adapters/parse';

async function main() {
  for (const title of ['亭台闲坐', '炽火之舞', 'Natlan Combat']) {
    const wt = await getWikitext('genshin-impact', title);
    const block = (wt.match(/\{\{[^}]*Soundtrack Usage[^}]*\}\}/g) || []).join('\n');
    console.log(`\n### ${title}`);
    console.log(block.slice(0, 400) || '(no Soundtrack Usage block)');
  }
  // Is Jade Moon in Category:Soundtracks or Category:Albums?
  for (const cat of ['Category:Soundtracks', 'Category:Albums', 'Category:Album Soundtracks']) {
    const m = await getCategoryMembers('genshin-impact', cat, 2000);
    const hit = m.find((x) => /jade moon/i.test(x));
    console.log(`\n${cat}: ${m.length} members; Jade Moon present? ${!!hit}`);
  }
  // HSR album category?
  for (const cat of ['Category:Albums', 'Category:Soundtracks', 'Category:Album Soundtracks']) {
    const m = await getCategoryMembers('honkai-star-rail', cat, 2000);
    const hit = m.find((x) => /galaxy/i.test(x));
    console.log(`\nHSR ${cat}: ${m.length} members; Galaxy album present? ${!!hit}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
