/**
 * Probe: validate HSR `during` extraction + wiki resolution on a SAMPLE.
 * Not a full crawl — just enough to confirm the approach before committing.
 */
import fs from 'fs';
import path from 'path';
import { resolveEntity, classifyDuring, extractEntity } from './adapters/resolve';

const DS = path.join(__dirname, 'out', 'music-source-dataset.json');

async function main() {
  const ds = JSON.parse(fs.readFileSync(DS, 'utf8'));
  const raws: string[] = [];
  for (const t of ds.hsr.tracks) for (const l of t.locations || []) raws.push(l.raw || '');

  // ---- 1. extraction stats ----
  const byKind: Record<string, Set<string>> = {};
  for (const r of raws) {
    const k = classifyDuring(r);
    const e = extractEntity(r, k);
    (byKind[k] = byKind[k] || new Set()).add(e);
  }
  console.log('=== distinct entities per kind (all 502 durings) ===');
  let total = 0;
  for (const k of Object.keys(byKind).sort()) {
    console.log(`  ${k.padEnd(8)} ${byKind[k].size}`);
    total += byKind[k].size;
  }
  console.log(`  TOTAL distinct entities to resolve: ${total}`);

  // ---- 2. resolve a sample spanning kinds ----
  const samples: string[] = [
    'Dialogue scene in Dragon Mislay, Dreams Astray', // story -> location
    'Phantasmoon Courtyard', // location
    'Central Starskiff Haven', // location
    'Fyxestroll Garden, Near the Guqin', // location
    'Argenti (Boss)', // boss
    'Flame Reaver of the Deepest Dark (Phase 2)', // boss
    'Jade Trailer — "A Collection of Desires"', // promo
    'Version 2.7 Trailer — "A New Venture on the Eighth Dawn"', // promo
    'Animated Short: A Flash', // story
    'Event Luminary Wardance (Combat)', // event
  ];

  console.log('\n=== resolution sample ===');
  for (const s of samples) {
    const r = await resolveEntity('honkai-star-rail', s);
    console.log(`\n• ${s}`);
    console.log(`   kind=${r.kind} entity="${r.entity}" resolved=${r.resolved} method=${r.method}`);
    console.log(`   enPath: ${JSON.stringify(r.enPath)}`);
    console.log(`   zhPath: ${JSON.stringify(r.zhPath)}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
