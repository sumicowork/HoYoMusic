import { getWikitext, apiGet } from './fandomClient';

// Known English track names that DEFINITELY exist in our DB (verified earlier: doom bloom/peak/defeat/choice all hit)
const probes = [
  'Rex Incognito',
  'Doom Bloom',
  'PEAK',
  'Choice',
  'Defeat',
  'Genshin Impact Main Theme',
  'Liyue',
  'Swirl of Covenants',
  'Starfire (Soundtrack)',
  'Trailblazer',
  'Nameless Faces',
  'Wildfire',
];

(async () => {
  for (const q of probes) {
    // direct page fetch
    let direct = 'N/A';
    try {
      const wt = await getWikitext('genshin-impact', q);
      direct = wt.length > 50 ? `PAGE EXISTS (${wt.length} chars)` : 'page empty/stub';
    } catch (e: any) {
      direct = 'NO PAGE (' + (e.message || '').slice(0, 40) + ')';
    }
    // search
    let searchHits: string[] = [];
    try {
      const s = await apiGet('genshin-impact', {
        action: 'query', list: 'search', srsearch: q, srlimit: '5',
      });
      searchHits = (s.query?.search || []).map((x: any) => x.title);
    } catch {}
    console.log(`\n### "${q}"`);
    console.log(`   direct page: ${direct}`);
    console.log(`   search hits: ${searchHits.join(' | ') || '(none)'}`);
  }
})();
