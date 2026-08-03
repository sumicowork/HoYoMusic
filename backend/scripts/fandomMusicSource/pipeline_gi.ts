/**
 * pipeline_gi.ts — Clean, reproducible Genshin (game_id=1) music-source rebuild.
 *
 * Design (user-confirmed 2026-07-12):
 *   - "music-first" (方案 B): build tree FROM the music, not the other way around.
 *   - Every fandom `dimension` becomes its OWN parallel category tree, so
 *     geographic ("在哪播") and situational/contextual sources never mix.
 *   - Normalization keeps the CLEAN main name as the node; condition/affix
 *     suffixes (e.g. "night; rain", "all times; near Cryo Hypostasis", "phase 2")
 *     are stripped and stored as a per-edge `note` (small footnote by the track).
 *   - Translation: fandom `{{Other Languages}}` is the #1 authority; Transclude
 *     is followed. NEVER guess — untranslated stays English + `pending`.
 *   - Numeric artifacts (teapot load `|teapot = 40`, media disc `|mediaoriginal = 1`)
 *     are attributes, not scenes — filtered out, never become nodes.
 *   - applyPlan prunes orphan nodes (no edge + no child) so a clean rebuild is
 *     fully reproducible with zero post-hoc manual deletes.
 *   - Self-bootstrapping: nodes are CREATED from the dataset; nothing depends on
 *     legacy AI nodes. Deleting all Genshin source data and re-running this
 *     script regenerates it deterministically.
 *
 * Inputs:   out/music-source-dataset.json (the fandom crawl) + .cache/ (fandom
 *           translation cache, via fandomClient).
 * Output:   music_source_categories / music_source_nodes / track_music_sources
 *           for game_id = 1.
 *
 * Usage:
 *   ts-node scripts/fandomMusicSource/pipeline_gi.ts            # dry-run (no DB, no network)
 *   ts-node scripts/fandomMusicSource/pipeline_gi.ts --apply    # backup + translate + insert
 *   ts-node scripts/fandomMusicSource/pipeline_gi.ts --offline   # translate from cache only
 */
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { getWikitext, parseOtherLanguages, setOffline } from './fandomClient';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const GAME_ID = 1; // Genshin
const WIKI = 'genshin';
const DATASET = path.resolve(__dirname, 'out/music-source-dataset.json');

// Shared DB connection, set during --apply so getZh can read the single-source
// translation library (genshin_terms) instead of re-crawling fandom per node.
let sharedDb: Client | null = null;


// ---------------------------------------------------------------------------
// Dimension model. `rule` drives normalization:
//   geo       : keep the LEADING run of real-geography segments (strip conditions)
//   firstOnly : the first segment is the entity; everything after is an affix
//   asis      : keep the full path as-is (teapot ranks, media versions)
// zh labels are OUR labels (safe to translate; not proper-noun guessing).
// ---------------------------------------------------------------------------
const DIMENSION_META: Record<string, { en: string; zh: string; rule: 'geo' | 'firstOnly' | 'asis' }> = {
  location: { en: 'Location', zh: '地区', rule: 'geo' },
  quest: { en: 'Quest', zh: '任务', rule: 'firstOnly' },
  domain: { en: 'Domain', zh: '秘境', rule: 'firstOnly' },
  eventgameplay: { en: 'Event Gameplay', zh: '活动玩法', rule: 'firstOnly' },
  teapot: { en: 'Serenitea Pot', zh: '尘歌壶', rule: 'geo' },
  mediaoriginal: { en: 'Media Original', zh: '媒体原声', rule: 'asis' },
  special: { en: 'Special', zh: '特殊', rule: 'firstOnly' },
  special_displayed: { en: 'Special Displayed', zh: '特殊展示', rule: 'firstOnly' },
};

// ===========================================================================
// Pure helpers
// ===========================================================================
function normAgg(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[“”‘’]/g, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface RawLoc { dimension?: string; kind?: string; enPath?: string[]; raw?: string; pending?: boolean; zhPath?: string[]; }
interface NormLoc { dimension: string; cleanPath: string[]; affix: string | null; }

// Event/special dims embed "Name/YYYY-MM-DD" or "Name/Mode" inside one segment;
// split on "/" so the trailing part becomes an affix, not part of the node name.
const SPLIT_SLASH_DIMS = new Set(['eventgameplay', 'special', 'special_displayed']);

const PAREN_RE = /\s*\([^)]*\)\s*/g;
function stripParen(seg: string): { name: string; paren: string | null } {
  const m = seg.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  if (m) return { name: m[1].trim(), paren: m[2].trim() };
  return { name: seg.trim(), paren: null };
}

/** A segment is a condition/context (goes to affix, not the tree) if it is a
 *  temporal/weather/encounter modifier or a date. Deliberately conservative. */
function isConditionSegment(seg: string): boolean {
  if (seg.includes(';')) return true;
  if (/^\d{4}-\d{2}-\d{2}$/.test(seg)) return true;
  if (
    /^(day|night|all times|all day|rain|wind|snow|storm|combat|phase\s*\d+|near\b|during\b|after\b|before\b|snippet|challenge|challenges|all challenges|cutscene|showdown|trial|test run|boss|enemy|co-?op)\b/i.test(
      seg,
    )
  )
    return true;
  return false;
}

function normalizeOne(loc: RawLoc): NormLoc {
  const dim = loc.dimension || loc.kind || '';
  const meta = DIMENSION_META[dim];
  if (!meta) return { dimension: dim, cleanPath: [], affix: null };

  const segs = (loc.enPath || [])
    .map((s) => (s || '').trim())
    .filter(Boolean)
    .map(stripParen);

  // For event/special dims, a segment may embed "Name/YYYY-MM-DD" or "Name/Mode";
  // split on "/" so the trailing part becomes an affix, not part of the node name.
  let expandedSegs = segs;
  if (SPLIT_SLASH_DIMS.has(dim)) {
    expandedSegs = [];
    for (const s of segs) {
      const parts = s.name.split('/').map((x) => x.trim()).filter(Boolean);
      parts.forEach((p, i) => expandedSegs.push({ name: p, paren: i === 0 ? s.paren : null }));
    }
  }

  const affixParts: string[] = [];
  for (const s of expandedSegs) if (s.paren) affixParts.push(s.paren);

  let clean: string[];
  if (meta.rule === 'asis') {
    clean = expandedSegs.map((s) => s.name);
  } else if (meta.rule === 'firstOnly') {
    clean = expandedSegs.length ? [expandedSegs[0].name] : [];
    if (expandedSegs.length > 1) {
      for (const s of expandedSegs.slice(1)) affixParts.push(s.paren ? `${s.name} (${s.paren})` : s.name);
    }
  } else {
    // geo: keep leading run of real-geography segments; first condition + rest → affix
    clean = [];
    let hit = false;
    for (const s of expandedSegs) {
      if (!hit && isConditionSegment(s.name)) hit = true;
      if (hit) affixParts.push(s.paren ? `${s.name} (${s.paren})` : s.name);
      else clean.push(s.name);
    }
  }

  // Numeric artifacts (teapot load `|teapot = 40`, media disc `|mediaoriginal = 1`)
  // are attributes, not scenes — never materialize them as nodes. Decimal version
  // numbers like "3.2" are kept. Reproducible: a clean rebuild won't recreate them.
  if (dim === 'teapot' || dim === 'mediaoriginal') {
    clean = clean.filter((s) => !/^\d+$/.test(s));
  }

  const affix = affixParts.length ? affixParts.join('; ') : null;
  return { dimension: dim, cleanPath: clean, affix };
}

// ===========================================================================
// Plan builder (pure — no DB, no network)
// ===========================================================================
interface PlanNode { key: string; name: string; parentKey: string | null; dimension: string; depth: number; }
interface PlanEdge { trackNormTitle: string; nodeKey: string; affix: string | null; dimension: string; order: number; }
interface Plan {
  categories: { dimension: string; en: string; zh: string }[];
  nodes: PlanNode[];
  edges: PlanEdge[];
  uniqueNames: string[];
  warnings: string[];
  stats: Record<string, { nodes: number; edges: number; depthHist: Record<number, number> }>;
  tracksTotal: number;
  tracksWithLoc: number;
}

function nodeKeyOf(dimension: string, path: string[]): string {
  return `${dimension}::${path.join(' / ')}`;
}

function buildPlan(tracks: any[]): Plan {
  const categories = new Map<string, { dimension: string; en: string; zh: string }>();
  const nodeMap = new Map<string, PlanNode>();
  const edgeMap = new Map<string, PlanEdge>(); // dedupe identical edges
  const uniqueNameSet = new Set<string>();
  const warnings: string[] = [];
  const stats: Plan['stats'] = {};
  let tracksWithLoc = 0;

  for (const t of tracks) {
    const locs: RawLoc[] = t.locations || [];
    if (locs.length) tracksWithLoc++;
    const trackNormTitle = normAgg(t.otherLanguages?.en || t.pageTitle || t.trackTitle || '');
    const edgeKeyBase = `${trackNormTitle}`;
    let order = 0;
    for (const loc of locs) {
      const norm = normalizeOne(loc);
      if (!DIMENSION_META[norm.dimension]) {
        warnings.push(`未知 dimension 跳过: "${norm.dimension}" (track=${t.trackTitle})`);
        continue;
      }
      if (norm.cleanPath.length === 0) {
        warnings.push(`cleanPath 为空，丢弃: dim=${norm.dimension} raw="${(loc.raw || '').slice(0, 60)}" (track=${t.trackTitle})`);
        continue;
      }
      const dim = norm.dimension;
      if (!categories.has(dim)) {
        const m = DIMENSION_META[dim];
        categories.set(dim, { dimension: dim, en: m.en, zh: m.zh });
      }
      // build node chain
      const path: string[] = [];
      for (let i = 0; i < norm.cleanPath.length; i++) {
        path.push(norm.cleanPath[i]);
        const key = nodeKeyOf(dim, path);
        if (!nodeMap.has(key)) {
          const parentKey = i === 0 ? null : nodeKeyOf(dim, path.slice(0, i));
          nodeMap.set(key, { key, name: norm.cleanPath[i], parentKey, dimension: dim, depth: i });
          uniqueNameSet.add(norm.cleanPath[i]);
        }
      }
      const leafKey = nodeKeyOf(dim, norm.cleanPath);
      const eKey = `${edgeKeyBase}@@${leafKey}`;
      if (!edgeMap.has(eKey)) {
        edgeMap.set(eKey, { trackNormTitle, nodeKey: leafKey, affix: norm.affix, dimension: dim, order: order++ });
      }
    }
  }

  const nodes = [...nodeMap.values()];
  const edges = [...edgeMap.values()];
  for (const n of nodes) {
    const s = (stats[n.dimension] ||= { nodes: 0, edges: 0, depthHist: {} });
    s.nodes++;
    s.depthHist[n.depth] = (s.depthHist[n.depth] || 0) + 1;
  }
  for (const e of edges) {
    const s = (stats[e.dimension] ||= { nodes: 0, edges: 0, depthHist: {} });
    s.edges++;
  }

  // review: node names that look like accidentally-kept conditions (exact-match only)
  const suspect = nodes
    .filter((n) => /^(day|night|factory|shop|inn|market|combat|phase|all times|rain|wind|current)$/i.test(n.name))
    .map((n) => `${n.dimension}: ${n.name}`);
  if (suspect.length) warnings.push(`疑似被误保留为节点的条件词(${suspect.length}): ` + suspect.slice(0, 10).join(', ') + ' …');

  return {
    categories: [...categories.values()],
    nodes,
    edges,
    uniqueNames: [...uniqueNameSet],
    warnings,
    stats,
    tracksTotal: tracks.length,
    tracksWithLoc,
  };
}

// ===========================================================================
// Translation (fandom-first; follows Transclude; never guesses)
// ===========================================================================
async function getZh(name: string): Promise<{ zh: string | null; status: 'translated' | 'pending' }> {
  // 1) Prefer the shared translation library (genshin_terms) — single source of
  //    truth, established 2026-07-13. Avoids re-crawling fandom for every node.
  if (sharedDb) {
    try {
      const r = await sharedDb.query(
        'SELECT zhs, zht FROM genshin_terms WHERE wiki=$1 AND en_name=$2 LIMIT 1',
        [WIKI, name],
      );
      if (r.rows.length) {
        const zh = r.rows[0].zhs || r.rows[0].zht || null;
        if (zh) return { zh, status: 'translated' };
      }
    } catch {
      /* fall through to fandom crawl */
    }
  }
  // 2) Fallback: fandom {{Other Languages}} (unchanged behavior; never guesses)
  try {
    const wt = await getWikitext(WIKI, name);
    if (wt) {
      const ol = parseOtherLanguages(wt);
      const zh = ol.zhs || ol.zht || null;
      if (zh) return { zh, status: 'translated' };
      const m = wt.match(/\{\{\s*Transclude\s*\|([^}|]+)/i);
      if (m) {
        const base = m[1].trim();
        const wt2 = await getWikitext(WIKI, base);
        if (wt2) {
          const ol2 = parseOtherLanguages(wt2);
          const zh2 = ol2.zhs || ol2.zht || null;
          if (zh2) return { zh: zh2, status: 'translated' };
        }
      }
    }
  } catch {
    /* network/parse error → pending */
  }
  return { zh: null, status: 'pending' };
}

// ===========================================================================
// Dry-run report
// ===========================================================================
function printDryRun(plan: Plan): void {
  console.log('\n================ 原神音乐源流水线 · DRY-RUN ================');
  console.log(`曲目总数: ${plan.tracksTotal} | 有来源标注: ${plan.tracksWithLoc}`);
  console.log(`拟建 category 数: ${plan.categories.length}`);
  console.log(`拟建 node 总数: ${plan.nodes.length}`);
  console.log(`拟建 edge 总数: ${plan.edges.length}`);
  console.log(`需翻译的唯一节点名: ${plan.uniqueNames.length}`);
  console.log('\n--- 各维度 ---');
  for (const c of plan.categories) {
    const s = plan.stats[c.dimension] || { nodes: 0, edges: 0, depthHist: {} };
    const dh = Object.entries(s.depthHist).sort((a, b) => +a[0] - +b[0]).map(([d, n]) => `d${d}:${n}`).join(' ');
    console.log(`  [${c.zh}/${c.en}] nodes=${s.nodes} edges=${s.edges} (${dh})`);
  }
  console.log('\n--- 归一化样本（主名 → 条件备注）---');
  const seen = new Set<string>();
  for (const e of plan.edges) {
    if (seen.has(e.dimension)) continue;
    seen.add(e.dimension);
    const samples = plan.edges.filter((x) => x.dimension === e.dimension).slice(0, 6);
    for (const s of samples) {
      const node = plan.nodes.find((n) => n.key === s.nodeKey);
      console.log(`  ${e.dimension}: "${node?.name}"${s.affix ? `  → 备注: ${s.affix}` : ''}`);
    }
  }
  if (plan.warnings.length) {
    console.log(`\n--- 警告(${plan.warnings.length}) ---`);
    for (const w of plan.warnings.slice(0, 20)) console.log('  ! ' + w);
  }
  console.log('\n[dry-run] 未连接数据库，未发起任何网络请求。加 --apply 才落库（会先备份）。');
}

// ===========================================================================
// Apply
// ===========================================================================
async function applyPlan(plan: Plan): Promise<void> {
  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });
  await client.connect();
  sharedDb = client; // expose connection to getZh so it prefers genshin_terms

  // pre-check
  const pre = await client.query(
    `select
       (select count(*) from music_source_categories where game_id=$1) as c,
       (select count(*) from music_source_nodes where game_id=$1) as n,
       (select count(*) from track_music_sources where game_id=$1) as e`,
    [GAME_ID],
  );
  const p = pre.rows[0];
  console.log(`\n[pre-check] game_id=${GAME_ID} 现有 categories=${p.c} nodes=${p.n} edges=${p.e}`);

  // backup (iron rule) — even if empty, cheap and safe
  const ts = Date.now();
  for (const t of ['music_source_categories', 'music_source_nodes', 'track_music_sources']) {
    const bak = `${t}_bak_gi_apply_${ts}`;
    await client.query(`CREATE TABLE ${bak} AS SELECT * FROM ${t} WHERE game_id=$1`, [GAME_ID]);
    console.log(`[backup] ${bak} (game_id=${GAME_ID})`);
  }

  // ensure note column exists (idempotent; mirrors migration 0004)
  await client.query(`ALTER TABLE track_music_sources ADD COLUMN IF NOT EXISTS note text`);

  // 1) categories (upsert by game_id+name)
  const catIdByDim = new Map<string, number>();
  for (const c of plan.categories) {
    await client.query(
      `INSERT INTO music_source_categories (game_id, name, en_name, translation_status, display_order)
       VALUES ($1,$2,$3,'translated',0)
       ON CONFLICT (game_id, name) DO NOTHING`,
      [GAME_ID, c.zh, c.en],
    );
    const r = await client.query(`SELECT id FROM music_source_categories WHERE game_id=$1 AND name=$2`, [GAME_ID, c.zh]);
    catIdByDim.set(c.dimension, r.rows[0].id);
  }
  console.log(`[apply] categories upserted: ${catIdByDim.size}`);

  // 2) translate unique names
  console.log(`[apply] 翻译 ${plan.uniqueNames.length} 个唯一节点名 (fandom, 缓存复用) …`);
  const trByName = new Map<string, { zh: string | null; status: 'translated' | 'pending' }>();
  let done = 0;
  for (const name of plan.uniqueNames) {
    trByName.set(name, await getZh(name));
    if (++done % 50 === 0) console.log(`  … 已翻译 ${done}/${plan.uniqueNames.length}`);
  }
  const translatedCount = [...trByName.values()].filter((v) => v.status === 'translated').length;
  console.log(`[apply] 翻译完成: ${translatedCount}/${plan.uniqueNames.length} 已译, ${plan.uniqueNames.length - translatedCount} 待译(pending)`);

  // 3) nodes — insert in depth order so parent ids resolve; upsert by unique key
  const keyToId = new Map<string, number>();
  const sortedNodes = [...plan.nodes].sort((a, b) => a.depth - b.depth);
  for (const n of sortedNodes) {
    const catId = catIdByDim.get(n.dimension)!;
    const parentId = n.parentKey ? keyToId.get(n.parentKey) ?? null : null;
    const tr = trByName.get(n.name) || { zh: null, status: 'pending' as const };
    const displayName = tr.zh || n.name;
    await client.query(
      `INSERT INTO music_source_nodes (game_id, category_id, parent_id, name, en_name, translation_status)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (game_id, category_id, parent_id, name) DO NOTHING`,
      [GAME_ID, catId, parentId, displayName, n.name, tr.status],
    );
    const r = await client.query(
      `SELECT id FROM music_source_nodes WHERE game_id=$1 AND category_id=$2 AND parent_id IS NOT DISTINCT FROM $3 AND name=$4`,
      [GAME_ID, catId, parentId, displayName],
    );
    if (r.rows[0]) keyToId.set(n.key, r.rows[0].id);
  }
  console.log(`[apply] nodes upserted: ${keyToId.size}/${sortedNodes.length}`);

  // 4) track_id map via title_en (same join as validated apply_edges)
  const trackRows = await client.query(
    `SELECT t.id, t.title_en FROM tracks t JOIN albums a ON t.album_id=a.id WHERE a.game_id=$1`,
    [GAME_ID],
  );
  const trackMap = new Map<string, number>();
  for (const r of trackRows.rows) if (r.title_en) trackMap.set(normAgg(r.title_en), r.id);

  // 5) edges
  let inserted = 0;
  let unmatchedTrack = 0;
  let unmatchedNode = 0;
  let withNote = 0;
  for (const e of plan.edges) {
    const trackId = trackMap.get(e.trackNormTitle);
    if (!trackId) { unmatchedTrack++; continue; }
    const nodeId = keyToId.get(e.nodeKey);
    if (!nodeId) { unmatchedNode++; continue; }
    const catId = catIdByDim.get(e.dimension)!;
    await client.query(
      `INSERT INTO track_music_sources (track_id, game_id, category_id, node_id, note, display_order)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (track_id, node_id) DO NOTHING`,
      [trackId, GAME_ID, catId, nodeId, e.affix, e.order],
    );
    inserted++;
    if (e.affix) withNote++;
  }
  const finalE = (await client.query(`SELECT count(*) n FROM track_music_sources WHERE game_id=$1`, [GAME_ID])).rows[0].n;
  const finalN = (await client.query(`SELECT count(*) n FROM music_source_nodes WHERE game_id=$1`, [GAME_ID])).rows[0].n;
  console.log(`[apply] edges: 尝试 ${plan.edges.length} | 插入 ${inserted} | 未匹配track ${unmatchedTrack} | 未匹配node ${unmatchedNode} | 带备注 ${withNote}`);
  console.log(`[apply] 落库后: nodes=${finalN} edges=${finalE}`);

  // 6) Prune orphan nodes (no edge AND no child) — reproducible cleanup.
  //    Guarantees nodes whose track never matched the DB (or numeric artifacts
  //    that slipped through) never persist across a clean rebuild.
  let pruned = 0;
  for (;;) {
    const r = await client.query(
      `DELETE FROM music_source_nodes mn WHERE mn.game_id=$1
         AND NOT EXISTS (SELECT 1 FROM track_music_sources t WHERE t.node_id=mn.id)
         AND NOT EXISTS (SELECT 1 FROM music_source_nodes ch WHERE ch.parent_id=mn.id)`,
      [GAME_ID],
    );
    pruned += r.rowCount ?? 0;
    if (!r.rowCount) break;
  }
  if (pruned) {
    const after = (await client.query(`SELECT count(*) n FROM music_source_nodes WHERE game_id=$1`, [GAME_ID])).rows[0].n;
    console.log(`[apply] 剪枝孤儿节点: ${pruned} (剩余 nodes=${after})`);
  }

  // drop this run's interim backup tables (empty on a clean rebuild)
  for (const t of ['music_source_categories', 'music_source_nodes', 'track_music_sources']) {
    await client.query(`DROP TABLE IF EXISTS ${t}_bak_gi_apply_${ts}`).catch(() => {});
  }

  sharedDb = null;
  await client.end();
}

// ===========================================================================
// main
// ===========================================================================
async function main(): Promise<void> {
  const APPLY = process.argv.includes('--apply');
  const OFFLINE = process.argv.includes('--offline');
  if (OFFLINE) setOffline(true);

  if (!fs.existsSync(DATASET)) {
    console.error(`数据集不存在: ${DATASET}`);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(DATASET, 'utf8'));
  const tracks: any[] = data.genshin?.tracks || [];
  console.log(`已加载数据集: genshin.tracks = ${tracks.length}`);

  const plan = buildPlan(tracks);
  printDryRun(plan);

  if (!APPLY) return;
  console.log('\n[apply] 开始落库 …');
  await applyPlan(plan);
  console.log('[apply] 完成。建议跑验证：节点无孤儿/无边、翻译覆盖、层级树正确。');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
