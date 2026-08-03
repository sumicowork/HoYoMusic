/**
 * Orchestrator for the music-source rebuild (DRY-RUN by default).
 *
 * For each game it enumerates `Category:Soundtracks`, classifies every page,
 * parses soundtrack pages, translates location paths, and writes a structured
 * dataset to out/music-source-dataset.json (+ out/summary.json).
 *
 * No DB writes happen here. Once the dataset quality is confirmed we add a
 * migration (en_name column) + an idempotent upsert pass in a later step.
 *
 * Run:  npx ts-node scripts/fandomMusicSource/run.ts            (full, slow)
 *       npx ts-node scripts/fandomMusicSource/run.ts --limit=20 (sample)
 */
import fs from 'fs';
import path from 'path';
import { getCategoryMembers, getWikitext } from './fandomClient';
import { Translator } from './translator';
import { genshinAdapter } from './adapters/genshin';
import { hsrAdapter } from './adapters/hsr';
import { resolveTrackLocations } from './adapters/resolve';
import { MusicSourceAdapter, ParsedTrack } from './adapters/types';

const OUT_DIR = path.join(__dirname, 'out');
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : 0;

async function runGame(adapter: MusicSourceAdapter, translator: Translator) {
  console.log(`\n=== ${adapter.wiki} ===`);
  const members = await getCategoryMembers(adapter.wiki, adapter.categoryTitle, LIMIT || 5000);
  const albumMembers = adapter.albumCategoryTitle
    ? await getCategoryMembers(adapter.wiki, adapter.albumCategoryTitle, LIMIT || 5000)
    : [];
  const allMembers = Array.from(new Set([...members, ...albumMembers]));
  console.log(`category members: ${members.length} (+albums ${albumMembers.length} = ${allMembers.length})`);
  const tracks: ParsedTrack[] = [];
  const albums: { title: string }[] = [];
  let skipped = 0;
  const sample = LIMIT || allMembers.length;

  for (let i = 0; i < Math.min(allMembers.length, sample); i++) {
    const title = allMembers[i];
    let wt = '';
    try {
      wt = await getWikitext(adapter.wiki, title);
    } catch (e) {
      skipped++;
      continue;
    }
    const kind = adapter.classify(wt, title);
    if (kind === 'skip') {
      skipped++;
      continue;
    }
    if (kind === 'album') {
      albums.push({ title });
      continue;
    }
    const t = adapter.parseTrack(wt, title);
    for (const loc of t.locations) {
      const { zhPath, pending } = translator.translatePath(loc.enPath);
      loc.zhPath = zhPath;
      loc.pending = pending;
    }
    const ol = t.otherLanguages;
    if (ol.zhs || ol.zht) t.trackTitle = ol.zhs || ol.zht || t.trackTitle;
    tracks.push(t);
    if (tracks.length <= 3) {
      console.log(
        `  sample: ${title} | locs=${JSON.stringify(t.locations.map((l) => l.enPath))} zh=${JSON.stringify(
          t.locations.map((l) => l.zhPath)
        )}`
      );
    }
  }
  console.log(`parsed tracks: ${tracks.length}, albums: ${albums.length}, skipped: ${skipped}`);
  return { tracks, albums };
}

async function main() {
  const translator = new Translator();
  await translator.load();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const genshin = await runGame(genshinAdapter, translator);
  const hsr = await runGame(hsrAdapter, translator);

  // Resolve HSR's dirty `during` fields into full location hierarchies.
  console.log('\n=== resolving HSR during -> location hierarchy ===');
  hsr.tracks = await resolveTrackLocations(hsr.tracks);
  console.log('HSR resolution done.');

  const dataset = { generatedAt: new Date().toISOString(), genshin, hsr };
  fs.writeFileSync(path.join(OUT_DIR, 'music-source-dataset.json'), JSON.stringify(dataset, null, 2));

  const pendingG = genshin.tracks.filter((t) => t.locations.some((l) => l.pending)).length;
  const pendingH = hsr.tracks.filter((t) => t.locations.some((l) => l.pending)).length;
  const withLocG = genshin.tracks.filter((t) => (t.locations || []).some((l) => (l.enPath || []).length > 0)).length;
  const withLocH = hsr.tracks.filter((t) => (t.locations || []).some((l) => (l.enPath || []).length > 0)).length;
  const dimG: Record<string, number> = {};
  let segTotalG = 0, segTransG = 0;
  for (const t of genshin.tracks)
    for (const l of t.locations || []) {
      if (l.dimension) dimG[l.dimension] = (dimG[l.dimension] || 0) + 1;
      for (let i = 0; i < (l.enPath || []).length; i++) {
        segTotalG++;
        const z = (l.zhPath || [])[i];
        if (z && z !== (l.enPath || [])[i]) segTransG++;
      }
    }
  let hsrDirty = 0;
  for (const t of hsr.tracks)
    for (const l of t.locations || []) for (const seg of l.enPath || []) if (/\b(scene|trailer|dialogue|short|animated|event|combat|boss)\b/i.test(seg) || seg.length > 35) hsrDirty++;
  // HSR during resolution stats, by kind
  const hsrRes: Record<string, { total: number; inTree: number; subjectOnly: number; noArticle: number; maxDepth: number }> = {};
  for (const t of hsr.tracks)
    for (const l of t.locations || []) {
      const k = l.kind || 'unknown';
      const s = (hsrRes[k] = hsrRes[k] || { total: 0, inTree: 0, subjectOnly: 0, noArticle: 0, maxDepth: 0 });
      s.total++;
      if (l.method === 'no-article') s.noArticle++;
      else if (l.hasParent) s.inTree++;
      else s.subjectOnly++;
      s.maxDepth = Math.max(s.maxDepth, (l.resolvedPath || []).length);
    }
  const summary = {
    generatedAt: dataset.generatedAt,
    genshin: {
      tracks: genshin.tracks.length,
      albums: genshin.albums.length,
      withLocation: withLocG,
      coveragePct: +((withLocG / genshin.tracks.length) * 100).toFixed(1),
      pendingTranslation: pendingG,
      dimensionDist: dimG,
      segmentTranslation: `${segTransG}/${segTotalG}`,
    },
    hsr: {
      tracks: hsr.tracks.length,
      albums: hsr.albums.length,
      withLocation: withLocH,
      coveragePct: +((withLocH / hsr.tracks.length) * 100).toFixed(1),
      pendingTranslation: pendingH,
      dirtyDuringCount: hsrDirty,
      resolutionByKind: hsrRes,
    },
    samples: {
      genshin: genshin.tracks.slice(0, 6).map((t) => ({ title: t.trackTitle, locs: t.locations })),
      hsr: hsr.tracks.slice(0, 6).map((t) => ({ title: t.trackTitle, locs: t.locations, credits: t.credits.slice(0, 3) })),
    },
  };
  fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log('\nWrote', path.join(OUT_DIR, 'music-source-dataset.json'));
  console.log('Summary:', JSON.stringify({ g: summary.genshin, h: summary.hsr }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
