/**
 * OFFLINE re-parse of the music-source dataset from the local .cache/.
 *
 * Reuses the HARDENED resolver (adapters/resolve.ts, with the 27-bug fix) and
 * the per-game adapters, but reads every page from disk instead of the network.
 * `fandomClient.setOffline(true)` makes apiGet return null on a cache miss, so
 * `resolveTrackLocations` (which walks parent chains via apiGet) stays fully
 * offline and never throws on a missing entity page.
 *
 * Output: out/music-source-dataset.json (same shape as run.ts) with refreshed
 * track titles, HSR resolved hierarchies, and Genshin multi-dim paths.
 *
 * Env: LIMIT=20  -> process at most N track pages per game (smoke test).
 */
import fs from 'fs';
import path from 'path';
import { setOffline } from './fandomClient';
import { Translator } from './translator';
import { genshinAdapter } from './adapters/genshin';
import { hsrAdapter } from './adapters/hsr';
import { resolveTrackLocations } from './adapters/resolve';
import { MusicSourceAdapter, ParsedTrack } from './adapters/types';

setOffline(true);

const CACHE_DIR = path.join(__dirname, '.cache');
const OUT_DIR = path.join(__dirname, 'out');
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : 0;

function wikiOf(filename: string): 'genshin' | 'hsr' | null {
  if (filename.startsWith('genshin-impact__')) return 'genshin';
  if (filename.startsWith('honkai-star-rail__')) return 'hsr';
  return null;
}

async function main() {
  const translator = new Translator();
  try {
    await translator.load();
  } catch {
    console.log('[translator] load failed (offline) — paths will stay pending for zh');
  }

  const byWiki: Record<string, { tracks: ParsedTrack[]; albums: { title: string }[] }> = {
    genshin: { tracks: [], albums: [] },
    hsr: { tracks: [], albums: [] },
  };

  const files = fs
    .readdirSync(CACHE_DIR)
    .filter((f) => f.endsWith('.json') && (f.startsWith('genshin-impact__') || f.startsWith('honkai-star-rail__')));

  let skipped = 0;
  for (const f of files) {
    const wiki = wikiOf(f)!;
    const adapter: MusicSourceAdapter = wiki === 'genshin' ? genshinAdapter : hsrAdapter;
    let d: any;
    try {
      d = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, f), 'utf8'));
    } catch {
      continue;
    }
    const p = d?.parse;
    if (!p || !p.title || !p.wikitext) continue; // category listings / search results have no `parse`
    const wt: string = p.wikitext['*'] || '';
    const title: string = p.title;
    const kind = adapter.classify(wt, title);
    if (kind === 'skip') continue;
    if (kind === 'album') {
      byWiki[wiki].albums.push({ title });
      continue;
    }
    if (LIMIT && byWiki[wiki].tracks.length >= LIMIT) continue;
    const t = adapter.parseTrack(wt, title);
    for (const loc of t.locations) {
      const { zhPath, pending } = translator.translatePath(loc.enPath);
      loc.zhPath = zhPath;
      loc.pending = pending;
    }
    const ol = t.otherLanguages;
    if (ol.zhs || ol.zht) t.trackTitle = (ol.zhs || ol.zht || t.trackTitle) as string;
    byWiki[wiki].tracks.push(t);
  }

  console.log(
    `parsed: genshin ${byWiki.genshin.tracks.length} tracks / ${byWiki.genshin.albums.length} albums | hsr ${byWiki.hsr.tracks.length} tracks / ${byWiki.hsr.albums.length} albums (skipped ${skipped})`
  );

  console.log('resolving HSR during -> location hierarchy (offline)...');
  byWiki.hsr.tracks = await resolveTrackLocations(byWiki.hsr.tracks);
  console.log('HSR resolution done.');

  const dataset = {
    generatedAt: new Date().toISOString(),
    offline: true,
    genshin: byWiki.genshin,
    hsr: byWiki.hsr,
  };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'music-source-dataset.json'), JSON.stringify(dataset, null, 2));
  console.log('Wrote', path.join(OUT_DIR, 'music-source-dataset.json'));

  // quick self-report
  for (const g of ['genshin', 'hsr'] as const) {
    const tr = byWiki[g].tracks;
    const withLoc = tr.filter((t) => (t.locations || []).some((l) => ((l.enPath || l.resolvedPath || []) as string[]).length > 0)).length;
    console.log(`  ${g}: ${tr.length} tracks, ${withLoc} with >=1 location`);
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
