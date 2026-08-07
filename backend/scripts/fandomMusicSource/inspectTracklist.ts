import { getWikitext, apiGet } from './fandomClient';
(async () => {
  // 1) Does fandom have an individual track page "Doom Bloom"?
  const s = await apiGet('genshin-impact', { action: 'query', list: 'search', srsearch: 'Doom Bloom', srlimit: '5' });
  console.log('search "Doom Bloom":', (s.query.search || []).map((x: any) => x.title));

  // 2) Inspect an OST page tracklist
  const wt = await getWikitext('genshin-impact', 'Akasha Pulses, the Kalpa Flame Rises (Soundtrack)');
  // tracklist often in {{Tracklist}} or a wikitable
  const tl = wt.match(/\{\{Tracklist[\s\S]*?\}\}/) || wt.match(/\{\|[\s\S]*?Tracklist[\s\S]*?\|\}/);
  console.log('\n=== Akasha Pulses page ===');
  console.log('has {{Tracklist}}?', /\{\{\s*Tracklist/i.test(wt), '| has Soundtrack Usage?', /Soundtrack Usage/i.test(wt));
  const lines = wt.split('\n').filter((l) => /Doom Bloom|Grain in the Bound|track/i.test(l)).slice(0, 8);
  console.log('track-ish lines:', lines);
  // show a 600-char window around "Soundtrack Usage" or tracklist
  const idx = wt.search(/Soundtrack Usage|Tracklist/i);
  if (idx >= 0) console.log('\nwindow:\n', wt.slice(idx, idx + 500));
})().catch((e) => { console.error(e); process.exit(1); });
