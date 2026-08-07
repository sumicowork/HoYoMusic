import { getCategoryMembers, getWikitext } from './fandomClient';
(async () => {
  for (const wiki of ['genshin-impact', 'honkai-star-rail']) {
    const cats = await getCategoryMembers(wiki, 'Category:Albums', 2000);
    console.log(`\n=== ${wiki} Category:Albums (${cats.length}) ===`);
    const sample = cats.slice(0, 3);
    for (const title of sample) {
      const wt = await getWikitext(wiki, title);
      const ib = (wt.match(/\{\{\s*[A-Za-z ]*Infobox[^{]*?\|/g) || []).slice(0, 3);
      console.log(`  * ${title}`);
      console.log(`     infobox-ish:`, ib);
      console.log(`     len:`, wt.length, 'has Soundtrack Infobox?', /\{\{\s*Soundtrack Infobox/i.test(wt), 'has Album Infobox?', /\{\{\s*Album Infobox/i.test(wt));
    }
  }
})().catch((e) => { console.error(e); process.exit(1); });
