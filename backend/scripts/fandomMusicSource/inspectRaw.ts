import { getWikitext } from './fandomClient';
(async () => {
  const page = 'Akasha Pulses, the Kalpa Flame Rises (Soundtrack)';
  const wt = await getWikitext('genshin-impact', page);
  console.log('len', wt.length);
  // find any section headings
  const heads = wt.match(/==+[^=]+==+/g) || [];
  console.log('headings:', heads.join(' | '));
  // show first 1500 chars after the infobox
  const idx = wt.indexOf('Soundtrack Usage');
  const start = idx > 0 ? idx : 0;
  console.log('\n--- around content ---\n', wt.slice(start, start + 1600));
})().catch((e) => { console.error(e); process.exit(1); });
