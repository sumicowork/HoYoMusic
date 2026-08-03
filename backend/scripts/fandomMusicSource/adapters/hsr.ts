import { MusicSourceAdapter, ParsedTrack } from './types';
import { parseInfobox, parseCreditsTable, cleanWikiText } from './parse';
import { parseOtherLanguages } from '../fandomClient';

/**
 * HSR adapter.
 * - "Where it plays" lives in `{{Soundtrack Infobox|during=Login Menu}}`.
 *   `during` is flat (no `//` hierarchy like Genshin). → music_source_nodes.
 * - `==Production Credits==` table is parsed as supplementary creator data.
 * - `{{Album Infobox}}` pages → albums.
 * Field names differ from Genshin → confirms the need for a per-game adapter.
 */
export const hsrAdapter: MusicSourceAdapter = {
  wiki: 'honkai-star-rail',
  categoryTitle: 'Category:Soundtracks',
  albumCategoryTitle: 'Category:Albums',
  classify(wt, title) {
    if (/\{\{\s*Album Infobox/i.test(wt)) return 'album';
    if (/\{\{\s*Soundtrack Infobox/i.test(wt)) return 'track';
    return 'skip';
  },
  parseTrack(wt, title): ParsedTrack {
    const ib = parseInfobox(wt, 'Soundtrack Infobox');
    const during = cleanWikiText(ib.during || ib.location || '');
    const enPaths = during
      ? [during.split('//').map((s) => s.trim()).filter(Boolean)]
      : [];
    return {
      wiki: 'hsr',
      pageTitle: title,
      trackTitle: (ib.title || title).replace(/\s*\(Soundtrack\)\s*$/i, '').trim(),
      album: ib.album || undefined,
      disc: ib.disc || undefined,
      number: ib.number ? parseInt(ib.number, 10) : undefined,
      youtubeId: ib.youtube_id || undefined,
      spotifyId: ib.spotify_id || undefined,
      locations: enPaths.map((enPath) => ({ enPath, zhPath: [], pending: true, raw: enPath.join(' // ') })),
      credits: parseCreditsTable(wt),
      otherLanguages: parseOtherLanguages(wt),
    };
  },
};
