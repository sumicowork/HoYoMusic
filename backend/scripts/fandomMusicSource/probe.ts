import { getWikitext } from './fandomClient';
import { Translator } from './translator';
import { genshinAdapter } from './adapters/genshin';
import { hsrAdapter } from './adapters/hsr';

const pages: [string, string][] = [
  ['genshin-impact', 'Unnamed Mondstadt Soundtrack 1'],
  ['genshin-impact', 'Moonlight Amidst Dreams (Soundtrack)'],
  ['genshin-impact', 'Jade Moon Upon a Sea of Clouds'],
  ['honkai-star-rail', 'Star Rail (Soundtrack)'],
  ['honkai-star-rail', 'Fate (Soundtrack)'],
  ['honkai-star-rail', 'A Night of Ever-Flame: Scene 33'],
];

async function main() {
  const t = new Translator();
  await t.load();
  for (const [wiki, title] of pages) {
    const wt = await getWikitext(wiki, title);
    const ad = wiki === 'genshin-impact' ? genshinAdapter : hsrAdapter;
    const kind = ad.classify(wt, title);
    if (kind !== 'track') {
      console.log(`\n[${title}] => ${kind}`);
      continue;
    }
    const tr = ad.parseTrack(wt, title);
    for (const loc of tr.locations) {
      const { zhPath, pending } = t.translatePath(loc.enPath);
      loc.zhPath = zhPath;
      loc.pending = pending;
    }
    console.log(`\n[${title}] kind=${kind}`);
    console.log('  trackTitle :', tr.trackTitle);
    console.log('  album/disc :', tr.album, '/', tr.disc, ' #', tr.number);
    console.log('  locations  :', JSON.stringify(tr.locations));
    console.log('  credits#   :', tr.credits.length, JSON.stringify(tr.credits.slice(0, 4)));
    console.log('  OL         :', JSON.stringify(tr.otherLanguages));
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
