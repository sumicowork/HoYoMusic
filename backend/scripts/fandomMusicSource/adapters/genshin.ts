import { MusicSourceAdapter, ParsedTrack, ParsedLocation } from './types';
import { parseInfobox, parseSoundtrackUsage, cleanWikiText } from './parse';
import { parseOtherLanguages } from '../fandomClient';

/**
 * Genshin adapter.
 * - "Where it plays" lives in `{{Soundtrack Usage|location=X//Y//Z|quest=...|...}}`,
 *   a MULTI-DIMENSIONAL template (location/quest/domain/teapot/eventgameplay/...).
 *   Each non-empty dimension → music_source_nodes of that category. `//` or `\` = hierarchy.
 * - Albums use `{{Album Infobox}}` → albums / album_discs (not a music source per se).
 * - `/Background` sub-pages and `SoundtrackTabs`-only pages are meta → skip.
 */
export const genshinAdapter: MusicSourceAdapter = {
  wiki: 'genshin-impact',
  categoryTitle: 'Category:Soundtracks',
  albumCategoryTitle: 'Category:Albums',
  classify(wt, title) {
    if (/\/Background$/i.test(title)) return 'skip';
    if (/\{\{\s*Album Infobox/i.test(wt)) return 'album';
    if (/\{\{\s*Soundtrack Infobox/i.test(wt)) return 'track';
    if (/Soundtrack Usage/i.test(wt)) return 'track';
    return 'skip';
  },
  parseTrack(wt, title): ParsedTrack {
    const ib = parseInfobox(wt, 'Soundtrack Infobox');
    const usageFields = parseSoundtrackUsage(wt);
    const locations: ParsedLocation[] = [];
    for (const f of usageFields) {
      for (const v of f.values) {
        const enPath = v
          .split(/\/\/|\\/)
          .map((s) => s.trim())
          .filter(Boolean);
        if (enPath.length)
          locations.push({ enPath, zhPath: [], pending: true, raw: v, dimension: f.dimension });
      }
    }
    if (locations.length === 0 && ib.title) {
      // some pages put the place in the infobox `during`/`location` too
      const d = cleanWikiText(ib.during || ib.location || '');
      if (d)
        locations.push({
          enPath: d.split(/\/\/|\\/).map((s) => s.trim()).filter(Boolean),
          zhPath: [],
          pending: true,
          raw: d,
        });
    }
    return {
      wiki: 'genshin',
      pageTitle: title,
      trackTitle: title.replace(/\s*\(Soundtrack\)\s*$/i, '').trim(),
      album: ib.album || undefined,
      disc: ib.disc || undefined,
      number: ib.number ? parseInt(ib.number, 10) : undefined,
      youtubeId: ib.youtube_id || undefined,
      spotifyId: ib.spotify_id || undefined,
      locations,
      credits: [],
      otherLanguages: parseOtherLanguages(wt),
    };
  },
};
