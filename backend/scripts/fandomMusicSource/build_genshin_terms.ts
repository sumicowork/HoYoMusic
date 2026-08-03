/**
 * build_genshin_terms.ts — Build & maintain a comprehensive Genshin proper-noun
 * translation library (genshin_terms) straight from fandom.
 *
 * WHY: the music-source tree and the lrc creator dictionary both need accurate
 * zh/ja/ko for the SAME Genshin proper nouns. Crawling fandom twice is wasteful
 * and risks divergent translations. This script produces ONE canonical library;
 * downstream consumers (music-source pipeline, lrc rebuild) read from it.
 *
 * COVERAGE ("无遗漏" within everything fandom documents as an entity):
 *   - Seeded from curated proper-noun root categories (Characters, Locations,
 *     Quests, Items, Enemies, Events, Domains, Weapons, Artifacts, Food,
 *     Animals, Books, Bosses, NPCs, …).
 *   - Recurses INTO every subcategory (BFS, depth-limited) so the whole entity
 *     tree is covered, not just the top level.
 *   - A page becomes a "term" ONLY if its wikitext carries {{Other Languages}}
 *     — this naturally filters out guide/list/template pages while keeping
 *     every real proper-noun entity that fandom documents.
 *
 * AUTHORITY (never guess):
 *   fandom {{Other Languages}}  →  if some langs missing, follow
 *   {{Transclude|base}}  →  still missing → leave lang NULL + status partial/pending.
 *
 * INCREMENTAL MAINTENANCE:
 *   Re-running only refreshes existing rows (idempotent upsert by (wiki,en_name))
 *   and adds new pages. Source of truth for completeness is fandom itself; the
 *   scheduled automation re-runs this weekly to pick up new game content.
 *
 * This script shares fandomClient's .cache/ with the music-source pipeline, so
 * translations already fetched elsewhere are reused for free.
 *
 * Usage:
 *   ts-node scripts/fandomMusicSource/build_genshin_terms.ts                 # dry-run, seeded BFS (16 curated roots)
 *   ts-node scripts/fandomMusicSource/build_genshin_terms.ts --all          # dry-run, SEED-FREE full crawl (all ns=0 pages)
 *   ts-node scripts/fandomMusicSource/build_genshin_terms.ts --all --apply  # upsert full crawl into genshin_terms
 *   ts-node scripts/fandomMusicSource/build_genshin_terms.ts --all --pilot  # tiny test: first 500 allpages only
 *   ts-node scripts/fandomMusicSource/build_genshin_terms.ts --offline      # parse from .cache only (no network)
 */
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import {
  getCategoryMembers,
  getAllPages,
  getWikitext,
  parseOtherLanguages,
  setOffline,
} from './fandomClient';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const WIKI = 'genshin';

// ---------------------------------------------------------------------------
// Curated proper-noun root categories. `label` becomes the stored `category`
// (our classification, safe — not a guessed translation). Subcategories inherit
// the label of the root they were reached from.
// ---------------------------------------------------------------------------
const SEED_CATEGORIES: { cat: string; label: string }[] = [
  { cat: 'Characters', label: 'character' },
  { cat: 'Non-Playable Characters', label: 'npc' },
  { cat: 'Locations', label: 'location' },
  { cat: 'Quests', label: 'quest' },
  { cat: 'Items', label: 'item' },
  { cat: 'Enemies', label: 'enemy' },
  { cat: 'Bosses', label: 'boss' },
  { cat: 'Events', label: 'event' },
  { cat: 'Domains', label: 'domain' },
  { cat: 'Weapons', label: 'weapon' },
  { cat: 'Artifacts', label: 'artifact' },
  { cat: 'Food', label: 'food' },
  { cat: 'Animals', label: 'animal' },
  { cat: 'Books', label: 'book' },
  { cat: 'Elements', label: 'element' },
  { cat: 'Achievements', label: 'achievement' },
];

const MAX_DEPTH = 6;

// Pages with these namespace prefixes are NOT proper-noun entity articles.
const SKIP_PREFIXES = [
  'Category:', 'File:', 'Image:', 'Template:', 'Media:', 'User:', 'Talk:',
  'Special:', 'Module:', 'Help:', 'Project:', 'Thread:', 'Message Wall:',
  'Blog:', 'Category talk:', 'Template talk:', 'User blog:',
];

interface Term {
  wiki: string;
  en_name: string;
  category: string | null;
  zhs: string | null;
  zht: string | null;
  ja: string | null;
  ko: string | null;
  source_page: string;
  status: 'translated' | 'partial' | 'pending';
}

function computeStatus(ol: Record<string, string>): Term['status'] {
  const have = [ol.zhs, ol.zht, ol.ja, ol.ko].filter(Boolean).length;
  if (have === 4) return 'translated';
  if (have > 0) return 'partial';
  return 'pending';
}

// ===========================================================================
// Discovery: BFS over categorymembers, collecting mainspace pages (ns=0).
// ===========================================================================
async function discoverPages(
  seeds: { cat: string; label: string }[],
  maxDepth: number,
): Promise<{ page: string; root: string }[]> {
  const visited = new Set<string>(); // category titles visited
  const result = new Map<string, string>(); // page title -> root label
  const queue: { cat: string; root: string; depth: number }[] = seeds.map(
    (s) => ({ cat: s.cat, root: s.label, depth: 0 }),
  );

  while (queue.length) {
    const { cat, root, depth } = queue.shift()!;
    if (visited.has(cat)) continue;
    visited.add(cat);

    const members = await getCategoryMembers(WIKI, `Category:${cat}`, 20000);
    for (const title of members) {
      if (title.startsWith('Category:')) {
        if (depth < maxDepth) {
          const sub = title.slice('Category:'.length);
          if (!visited.has(sub)) queue.push({ cat: sub, root, depth: depth + 1 });
        }
        continue;
      }
      if (SKIP_PREFIXES.some((p) => title.startsWith(p))) continue;
      if (!result.has(title)) result.set(title, root); // first root wins (deterministic)
    }
  }
  return [...result.entries()].map(([page, root]) => ({ page, root }));
}

// ===========================================================================
// Extraction: wikitext -> term (only if {{Other Languages}} present).
// Follows {{Transclude|base}} to recover translations the page itself lacks.
// ===========================================================================
async function extractTerm(page: string, category: string | null): Promise<Term | null> {
  const wt = await getWikitext(WIKI, page);
  if (!wt) return null;
  if (!/\{\{\s*Other Languages/.test(wt)) return null; // not a proper-noun entity page

  let ol = parseOtherLanguages(wt);
  let status = computeStatus(ol);

  if (status !== 'translated') {
    const m = wt.match(/\{\{\s*Transclude\s*\|([^}|]+)/i);
    if (m) {
      const base = m[1].trim();
      const wt2 = await getWikitext(WIKI, base);
      if (wt2) {
        const ol2 = parseOtherLanguages(wt2);
        ol = { ...ol2, ...ol }; // existing (page) values win; base fills gaps
        status = computeStatus(ol);
      }
    }
  }

  return {
    wiki: WIKI,
    en_name: page,
    category,
    zhs: ol.zhs || null,
    zht: ol.zht || null,
    ja: ol.ja || null,
    ko: ol.ko || null,
    source_page: page,
    status,
  };
}

// ===========================================================================
// Apply: idempotent upsert into genshin_terms.
// ===========================================================================
// Self-contained idempotent upsert for one batch. Creates its own connection
// and ensures the table exists (so it's safe to call repeatedly). main() calls
// this every BATCH pages so a killed process doesn't lose already-crawled data.
async function upsertBatch(terms: Term[]): Promise<{ inserted: number; updated: number }> {
  if (!terms.length) return { inserted: 0, updated: 0 };
  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });
  await client.connect();

  // Safety: ensure the table exists even if the migration hasn't been run yet.
  await client.query(`
    CREATE TABLE IF NOT EXISTS genshin_terms (
      id SERIAL PRIMARY KEY,
      wiki VARCHAR(40) NOT NULL DEFAULT 'genshin',
      en_name VARCHAR(300) NOT NULL,
      category VARCHAR(80),
      zhs VARCHAR(300),
      zht VARCHAR(300),
      ja VARCHAR(300),
      ko VARCHAR(300),
      source_page VARCHAR(300),
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      note TEXT,
      uuid UUID DEFAULT gen_random_uuid(),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (wiki, en_name)
    )
  `);

  let inserted = 0;
  let updated = 0;
  for (const t of terms) {
    const r = await client.query(
      `INSERT INTO genshin_terms (wiki, en_name, category, zhs, zht, ja, ko, source_page, status, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now())
       ON CONFLICT (wiki, en_name) DO UPDATE SET
         category   = EXCLUDED.category,
         zhs        = EXCLUDED.zhs,
         zht        = EXCLUDED.zht,
         ja         = EXCLUDED.ja,
         ko         = EXCLUDED.ko,
         source_page= EXCLUDED.source_page,
         status     = EXCLUDED.status,
         updated_at = now()`,
      [t.wiki, t.en_name, t.category, t.zhs, t.zht, t.ja, t.ko, t.source_page, t.status],
    );
    if ((r as any).rowCount === 1) inserted++;
    else updated++;
  }
  await client.end();
  return { inserted, updated };
}

// ===========================================================================
// main
// ===========================================================================
async function main(): Promise<void> {
  const APPLY = process.argv.includes('--apply');
  const OFFLINE = process.argv.includes('--offline');
  const PILOT = process.argv.includes('--pilot');
  const ALL = process.argv.includes('--all');
  if (OFFLINE) setOffline(true);

  console.log('================ 原神翻译库 (genshin_terms) 构建 ================');
  console.log(`模式: ${APPLY ? 'APPLY (落库)' : OFFLINE ? 'OFFLINE (仅缓存解析)' : 'DRY-RUN (抓取+统计, 不写库)'}${ALL ? ' [全量 allpages, 不依赖种子]' : ''}${PILOT ? ' [PILOT 试点]' : ''}`);

  let pages: { page: string; root: string | null }[];
  if (ALL) {
    const cap = PILOT ? 500 : 0; // pilot 下只取前 500 页做小试验
    const titles = await getAllPages(WIKI, 0, cap);
    pages = titles
      .filter((t) => !SKIP_PREFIXES.some((p) => t.startsWith(p)))
      .map((t) => ({ page: t, root: null }));
    console.log(`[all] 全量候选(ns=0): ${titles.length} → 过滤后 ${pages.length}${PILOT ? ' (PILOT 限制前 500)' : ''}`);
  } else {
    const seeds = PILOT ? SEED_CATEGORIES.slice(0, 1) : SEED_CATEGORIES;
    const maxDepth = PILOT ? 1 : MAX_DEPTH;
    pages = await discoverPages(seeds, maxDepth);
    console.log(`发现候选页面: ${pages.length} (来自 ${seeds.length} 个根分类, 最大深度 ${maxDepth})`);
  }

  const terms: Term[] = [];
  let noOL = 0;
  let done = 0;
  const BATCH = 200;
  let flushed = 0;
  let insTotal = 0;
  let updTotal = 0;
  for (const { page, root } of pages) {
    try {
      const t = await extractTerm(page, root);
      if (t) terms.push(t);
      else noOL++;
    } catch {
      /* network/parse error → skip page */
    }
    if (++done % BATCH === 0) {
      console.log(`  … 已处理 ${done}/${pages.length} (terms=${terms.length})`);
      if (APPLY) {
        const r = await upsertBatch(terms.slice(flushed));
        insTotal += r.inserted;
        updTotal += r.updated;
        flushed = terms.length;
        console.log(`  [apply] 累计落库 ${flushed} 条 (本次新增${r.inserted}/刷新${r.updated})`);
      }
    }
  }

  const byCat: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  for (const t of terms) {
    const cat = t.category || 'uncategorized';
    byCat[cat] = (byCat[cat] || 0) + 1;
    byStatus[t.status] = (byStatus[t.status] || 0) + 1;
  }

  console.log(`\n--- 结果 ---`);
  console.log(`术语总数: ${terms.length} | 无 {{Other Languages}} 跳过: ${noOL}`);
  console.log(`按状态: ${JSON.stringify(byStatus)}`);
  console.log(`按分类(top):`);
  Object.entries(byCat)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .forEach(([c, n]) => console.log(`  ${c}: ${n}`));

  if (PILOT) {
    console.log(`\n[PILOT] 样本术语 (前 15 条, 看数据质量):`);
    for (const t of terms.slice(0, 15)) {
      const langs = [t.zhs && `zhs=${t.zhs}`, t.zht && `zht=${t.zht}`, t.ja && `ja=${t.ja}`, t.ko && `ko=${t.ko}`].filter(Boolean).join(' ');
      console.log(`  ${t.en_name}  [${t.status}]  ${langs}`);
    }
  }

  if (APPLY) {
    if (flushed < terms.length) {
      const r = await upsertBatch(terms.slice(flushed));
      insTotal += r.inserted;
      updTotal += r.updated;
      flushed = terms.length;
    }
    console.log(`\n[apply] 完成: 累计落库 ${flushed} 条 (新增${insTotal}/刷新${updTotal})`);
  } else {
    console.log('\n[dry-run/offline] 未写入数据库。加 --apply 才落库。');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
