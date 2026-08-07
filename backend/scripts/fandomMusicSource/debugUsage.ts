import { getWikitext } from './fandomClient';
import { parseSoundtrackUsage } from './adapters/parse';
(async () => {
  for (const title of ['闲饮酣适', 'A Bright, Fresh Year']) {
    const wt = await getWikitext('genshin-impact', title);
    console.log(`\n### ${title}`);
    const blocks = wt.match(/\{\{[^{}]*Soundtrack Usage[^{}]*\}\}/g) || [];
    console.log('blocks:', blocks.length);
    blocks.forEach((b) => console.log(b));
    console.log('parsed:', JSON.stringify(parseSoundtrackUsage(wt), null, 1));
  }
})().catch((e) => { console.error(e); process.exit(1); });
