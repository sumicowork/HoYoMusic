/**
 * Enrichment pass: for every still-pending music-source segment, look up the
 * entity's OWN fandom article page and pull its `{{Other Languages}}` Chinese.
 *
 * Iron law: ONLY fandom `{{Other Languages}}` zhs/zht is used. No guessing,
 * no words.json here (that was already applied in run.ts). Every resolved
 * segment records its `sourcePage` so the self-check can prove zero fabrication.
 *
 * This is a SEPARATE pass over the existing dataset — run.ts / translator.ts
 * are NOT modified, so the already-verified pipeline stays intact.
 */
import fs from 'fs';
import path from 'path';
import { getWikitext, parseOtherLanguages } from './fandomClient';

const DATASET = path.join(__dirname, 'out', 'music-source-dataset.json');
const WIKI: Record<number, string> = { 1: 'genshin-impact', 2: 'honkai-star-rail' };

function zhOf(ol: Record<string, string>, en: string): string | null {
  const zh = ol['zhs'] || ol['zht'] || ol['zh'] || null;
  return zh && zh.trim() && zh.trim() !== en.trim() ? zh.trim() : null;
}

async function main() {
  const ds = JSON.parse(fs.readFileSync(DATASET, 'utf8'));

  // 1) collect distinct pending segments per game
  const pending: Record<number, Set<string>> = { 1: new Set(), 2: new Set() };
  const segInfo: Record<number, { parentCats: Set<string> }> = { 1: { parentCats: new Set() }, 2: { parentCats: new Set() } };
  for (const game of ['genshin', 'hsr'] as const) {
    const gid = game === 'genshin' ? 1 : 2;
    for (const t of ds[game].tracks) {
      for (const loc of t.locations || []) {
        const enPath: string[] = loc.enPath || loc.resolvedPath || [];
        const zhPath: string[] = loc.zhPath || loc.resolvedZhPath || [];
        for (let i = 0; i < enPath.length; i++) {
          const en = enPath[i];
          const zh = zhPath[i];
          if (!zh || zh === en) pending[gid].add(en);
        }
      }
    }
  }

  const segZh: Record<number, Map<string, { zh: string; sourcePage: string }>> = {
    1: new Map(), 2: new Map(),
  };

  for (const gid of [1, 2]) {
    const list = [...pending[gid]];
    console.log(`[game ${gid}] distinct pending segments: ${list.length}`);
    let done = 0, resolved = 0;
    for (const en of list) {
      try {
        const wt = await getWikitext(WIKI[gid], en);
        if (wt) {
          const ol = parseOtherLanguages(wt);
          const zh = zhOf(ol, en);
          if (zh) {
            segZh[gid].set(en, { zh, sourcePage: en });
            resolved++;
          }
        }
      } catch (e) {
        // network/rate — leave pending
      }
      done++;
      if (done % 100 === 0) console.log(`  progress ${done}/${list.length}  resolved=${resolved}`);
    }
    console.log(`[game ${gid}] resolved ${resolved}/${list.length} (${(resolved / list.length * 100).toFixed(0)}%)`);
  }

  // 2) fill zhPath in place
  let filled = 0;
  for (const game of ['genshin', 'hsr'] as const) {
    const gid = game === 'genshin' ? 1 : 2;
    const map = segZh[gid];
    for (const t of ds[game].tracks) {
      for (const loc of t.locations || []) {
        const enPath: string[] = loc.enPath || loc.resolvedPath || [];
        if (!loc.zhPath && loc.resolvedZhPath) loc.zhPath = loc.resolvedZhPath;
        const zhPath: string[] = loc.zhPath || (loc.zhPath = []);
        for (let i = 0; i < enPath.length; i++) {
          const en = enPath[i];
          const hit = map.get(en);
          if (hit && (!zhPath[i] || zhPath[i] === en)) {
            zhPath[i] = hit.zh;
            filled++;
          }
        }
      }
    }
  }
  console.log(`filled zhPath segments: ${filled}`);

  fs.writeFileSync(DATASET, JSON.stringify(ds));
  console.log('wrote enriched dataset:', DATASET);

  // 3) self-check: every resolved zh must equal cached page OL value
  let checkTotal = 0, checkFail = 0;
  for (const gid of [1, 2]) {
    for (const [en, info] of segZh[gid]) {
      checkTotal++;
      try {
        const wt = await getWikitext(WIKI[gid], info.sourcePage);
        const ol = parseOtherLanguages(wt);
        const zh = zhOf(ol, en);
        if (!zh || zh !== info.zh) {
          checkFail++;
          if (checkFail <= 10) console.log(`  SELFCHECK FAIL: ${en} expected ${info.zh} got ${zh}`);
        }
      } catch {
        checkFail++;
      }
    }
  }
  console.log(`SELF-CHECK: ${checkTotal - checkFail}/${checkTotal} resolved zh confirmed against cached page OL (fails=${checkFail})`);
}
main().catch((e) => { console.error(e); process.exit(1); });
