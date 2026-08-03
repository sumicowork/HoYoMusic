/**
 * Persist the verified music-source dataset into the production DB.
 *
 * Design rules (per user iron law — never guess, keep source English, mark
 * pending when untranslated):
 *   - `en_name`  = the English source segment (always kept)
 *   - `name`     = the Chinese translation if present, else the English source
 *   - `translation_status` = 'translated' iff zh != en, else 'pending'
 *
 * Idempotent: nodes upsert on the existing unique key
 * (game_id, category_id, parent_id, name); re-running never duplicates.
 *
 * Junk exclusion: HSR "Chinese Ver." / "Japanese Ver." pages feed Chinese
 * text (even a YouTube URL) into the `during` field, which the English-first
 * resolver misclassifies as a scene. We skip any location whose enPath contains
 * CJK or a URL — those 7 tracks are noise, not real scenes.
 *
 * Modes:
 *   --game hsr|genshin|all   (default: hsr — clean slate, zero risk)
 *   --genshin-mode skip|rebuild|reconcile   (default: skip)
 *       skip      = don't touch Genshin (it has 2550 prior-relay nodes)
 *       rebuild   = backup + wipe Genshin nodes, reload from verified dataset
 *       reconcile = map English dims onto existing Chinese categories, upsert
 *   --dry-run    (default) prints planned counts + samples, writes nothing
 *   --apply      performs the write (after an automatic pg_dump backup)
 *   --no-backup  skip the backup step on --apply (NOT recommended)
 *
 * Run:
 *   npx ts-node scripts/fandomMusicSource/persist.ts --game hsr --dry-run
 *   npx ts-node scripts/fandomMusicSource/persist.ts --game hsr --apply
 */
import 'dotenv/config';
import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

const DATASET = path.join(__dirname, 'out', 'music-source-dataset.json');

const GAME_ID: Record<string, number> = { genshin: 1, hsr: 2 };

// Genshin dimension -> existing Chinese category id (from the live DB sample).
// Used only in `reconcile` mode; unmapped dims get a fresh English category.
const GENSHIN_DIM_TO_CAT: Record<string, number> = {
  location: 14, // 场景音乐
  teapot: 15, // 尘歌壶
  domain: 18, // 秘境
  eventgameplay: 19, // 活动玩法
  quest: 25, // 世界任务 (generic quest bucket)
  mediaoriginal: 16, // 特殊玩法 (best-effort)
  special: 16,
  special_displayed: 16,
};

const HSR_KIND_CAT_EN: Record<string, string> = {
  location: 'location',
  boss: 'boss',
  story: 'story',
  event: 'event',
  promo: 'promo',
};

interface PlanNode {
  game_id: number;
  categoryKey: string; // logical key (game:dim or game:kind)
  categoryName: string; // category display name
  categoryEnName: string;
  en_name: string;
  name: string;
  translation_status: 'translated' | 'pending';
  depth: number;
  parentEnName: string | null;
}

function hasCJK(s: string): boolean {
  return /[一-鿿]/.test(s);
}
function isJunkLoc(loc: any): boolean {
  for (const seg of loc?.enPath || []) {
    if (hasCJK(String(seg))) return true;
    if (/https?:|youtube/i.test(String(seg))) return true;
  }
  return false;
}

function buildPlan(ds: any, game: 'genshin' | 'hsr', genshinMode: string): {
  categories: Map<string, { game_id: number; name: string; en_name: string }>;
  nodes: PlanNode[];
  junkSkipped: number;
} {
  const categories = new Map<string, { game_id: number; name: string; en_name: string }>();
  const nodes: PlanNode[] = [];
  const game_id = GAME_ID[game];
  let junkSkipped = 0;

  const addCat = (key: string, name: string, en_name: string) => {
    if (!categories.has(key)) categories.set(key, { game_id, name, en_name });
  };

  for (const t of ds[game].tracks) {
    for (const loc of t.locations || []) {
      if (isJunkLoc(loc)) {
        junkSkipped++;
        continue;
      }
      // choose the resolved hierarchy when available
      const enPath: string[] =
        game === 'hsr'
          ? loc.resolvedPath?.length
            ? loc.resolvedPath
            : loc.enPath || []
          : loc.enPath || [];
      const zhPath: string[] =
        game === 'hsr'
          ? loc.resolvedZhPath?.length
            ? loc.resolvedZhPath
            : loc.enPath || []
          : loc.zhPath || [];
      if (!enPath.length) continue;

      // category key
      let catKey: string, catName: string, catEn: string;
      if (game === 'hsr') {
        const kind = loc.kind || 'location';
        catKey = `hsr:${kind}`;
        catName = HSR_KIND_CAT_EN[kind] || kind;
        catEn = catName;
      } else {
        const dim = loc.dimension || 'location';
        if (genshinMode === 'reconcile' && GENSHIN_DIM_TO_CAT[dim]) {
          catKey = `genshin:cat:${GENSHIN_DIM_TO_CAT[dim]}`;
          catName = String(GENSHIN_DIM_TO_CAT[dim]); // resolved to id later
          catEn = dim;
        } else {
          catKey = `genshin:${dim}`;
          catName = dim;
          catEn = dim;
        }
      }
      addCat(catKey, catName, catEn);

      let parentEn: string | null = null;
      for (let i = 0; i < enPath.length; i++) {
        const en = enPath[i];
        const zh = zhPath[i];
        const translated = !!zh && zh !== en;
        nodes.push({
          game_id,
          categoryKey: catKey,
          categoryName: catName,
          categoryEnName: catEn,
          en_name: en,
          name: translated ? zh : en,
          translation_status: translated ? 'translated' : 'pending',
          depth: i,
          parentEnName: parentEn,
        });
        parentEn = en;
      }
    }
  }
  return { categories, nodes, junkSkipped };
}

async function dryRun(game: 'genshin' | 'hsr', genshinMode: string) {
  const ds = JSON.parse(fs.readFileSync(DATASET, 'utf8'));
  const { categories, nodes, junkSkipped } = buildPlan(ds, game, genshinMode);
  // dedupe nodes by (categoryKey, parentEnName, en_name)
  const seen = new Set<string>();
  const uniq: PlanNode[] = [];
  for (const n of nodes) {
    const k = `${n.categoryKey}|${n.parentEnName ?? '∅'}|${n.en_name}`;
    if (!seen.has(k)) {
      seen.add(k);
      uniq.push(n);
    }
  }
  const translated = uniq.filter((n) => n.translation_status === 'translated').length;
  console.log(`\n=== DRY-RUN [${game}] (genshin-mode=${genshinMode}) ===`);
  console.log(`  categories to ensure : ${categories.size}`);
  console.log(`  distinct nodes       : ${uniq.length}  (translated=${translated}, pending=${uniq.length - translated})`);
  console.log(`  junk locations skipped: ${junkSkipped}`);
  console.log('  sample categories:', [...categories.values()].slice(0, 8).map((c) => c.en_name).join(', '));
  console.log('  sample nodes:');
  for (const n of uniq.slice(0, 8))
    console.log(`    [${n.translation_status}] ${'  '.repeat(n.depth)}${n.en_name} -> ${n.name}`);
  return { categories, uniq };
}

async function backupTables(client: Client, game_id: number) {
  const ts = Date.now();
  console.log(`  in-DB backup -> music_source_*_bak_${ts} (game_id=${game_id})`);
  await client.query(
    `create table if not exists music_source_nodes_bak_${ts} as select * from music_source_nodes where game_id=$1`,
    [game_id]
  );
  await client.query(
    `create table if not exists music_source_categories_bak_${ts} as select * from music_source_categories where game_id=$1`,
    [game_id]
  );
  await client.query(
    `create table if not exists track_music_sources_bak_${ts} as
       select t.* from track_music_sources t
       join music_source_nodes n on n.id = t.node_id
       where n.game_id=$1`,
    [game_id]
  );
}

async function apply(game: 'genshin' | 'hsr', genshinMode: string, doBackup: boolean) {
  const ds = JSON.parse(fs.readFileSync(DATASET, 'utf8'));
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'hoyomusic',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
  });
  await client.connect();
  try {
    const gid = GAME_ID[game];
    if (doBackup) await backupTables(client, gid);

    if (game === 'genshin' && genshinMode === 'rebuild') {
      console.log('  rebuild mode: wiping existing Genshin music-source data (nodes+categories+links)...');
      await client.query(
        'delete from track_music_sources where node_id in (select id from music_source_nodes where game_id=$1)',
        [gid]
      );
      await client.query('delete from music_source_nodes where game_id=$1', [gid]);
      await client.query('delete from music_source_categories where game_id=$1', [gid]);
    }

    const { categories, nodes } = buildPlan(ds, game, genshinMode);
    // resolve category ids
    const catId = new Map<string, number>();
    for (const c of categories.values()) {
      if (game === 'genshin' && genshinMode === 'reconcile' && /^\d+$/.test(c.name)) {
        catId.set(`genshin:cat:${c.name}`, parseInt(c.name, 10)); // already an id
        continue;
      }
      const r = await client.query(
        `insert into music_source_categories (game_id, name, en_name, translation_status)
         values ($1,$2,$3,'translated')
         on conflict (game_id, name) do update set en_name=excluded.en_name
         returning id`,
        [c.game_id, c.name, c.en_name]
      );
      catId.set(
        game === 'genshin' && genshinMode === 'reconcile' ? `genshin:cat:${c.name}` : `${game}:${c.en_name}`,
        r.rows[0].id
      );
    }

    // insert nodes in path order, resolving parent ids
    const nodeId = new Map<string, number>(); // key: catId|parentId|en_name
    let inserted = 0;
    // group by category to keep parent ordering simple
    const byCat = new Map<number, PlanNode[]>();
    for (const n of nodes) {
      const cid =
        game === 'genshin' && genshinMode === 'reconcile'
          ? catId.get(n.categoryKey)!
          : catId.get(`${game}:${n.categoryEnName}`)!;
      if (!byCat.has(cid)) byCat.set(cid, []);
      byCat.get(cid)!.push(n);
    }
    for (const [cid, list] of byCat) {
      // sort by depth so parents exist first
      list.sort((a, b) => a.depth - b.depth);
      for (const n of list) {
        const parentKey = n.parentEnName ? `${cid}|${n.parentEnName}` : `${cid}|∅`;
        const parentId = n.parentEnName ? nodeId.get(parentKey) ?? null : null;
        const myKey = `${cid}|${n.en_name}`;
        const existing = nodeId.get(myKey);
        if (existing) continue;
        const r = await client.query(
          `insert into music_source_nodes (game_id, category_id, parent_id, name, en_name, translation_status)
           values ($1,$2,$3,$4,$5,$6)
           on conflict (game_id, category_id, parent_id, name)
           do update set en_name=excluded.en_name, translation_status=excluded.translation_status, updated_at=now()
           returning id`,
          [n.game_id, cid, parentId, n.name, n.en_name, n.translation_status]
        );
        nodeId.set(myKey, r.rows[0].id);
        inserted++;
      }
    }
    console.log(`  [${game}] applied. nodes upserted: ${inserted}`);
  } finally {
    await client.end();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const getVal = (flag: string): string | undefined => {
    const eq = args.find((a) => a.startsWith(flag + '='));
    if (eq) return eq.split('=')[1];
    const i = args.findIndex((a) => a === flag);
    if (i >= 0 && args[i + 1]) return args[i + 1];
    return undefined;
  };
  const gameArg = getVal('--game') || 'hsr';
  const genshinMode = getVal('--genshin-mode') || 'skip';
  const dry = args.includes('--dry-run') || !args.includes('--apply');
  const doApply = args.includes('--apply');
  const doBackup = doApply && !args.includes('--no-backup');

  const games = gameArg === 'all' ? (['genshin', 'hsr'] as const) : [gameArg as 'genshin' | 'hsr'];
  for (const g of games) {
    if (g === 'genshin' && genshinMode === 'skip') {
      console.log('\n=== Genshin: SKIPPED (genshin-mode=skip; 2550 prior-relay nodes left untouched) ===');
      continue;
    }
    if (dry) await dryRun(g, genshinMode);
    else if (doApply) await apply(g, genshinMode, doBackup);
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
