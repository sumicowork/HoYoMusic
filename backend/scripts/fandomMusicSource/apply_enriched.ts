/**
 * Apply enriched translations to the DB — IN PLACE, non-destructively.
 *
 * Strategy: the original nodes were persisted with `name = en_name` (English)
 * while pending. We now UPDATE only the rows that are still
 * `translation_status = 'pending'` and whose `en_name` matches a segment we
 * newly resolved to Chinese. The match key is (game_id, category_id, parent_id,
 * en_name) — `en_name` is the STABLE English source, so we update the SAME row
 * rather than inserting a duplicate Chinese-named node.
 *
 * No inserts, no deletes, no schema change. Idempotent: re-run flips nothing
 * new. Dry-run first prints the planned change count.
 */
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const DATASET = path.join(__dirname, 'out', 'music-source-dataset.json');
const GAME_ID: Record<string, number> = { genshin: 1, hsr: 2 };

interface PlanNode { game_id: number; catEn: string; parentEn: string | null; en: string; zh: string; }

function buildPlan(ds: any): PlanNode[] {
  const out: PlanNode[] = [];
  for (const game of ['genshin', 'hsr'] as const) {
    const gid = GAME_ID[game];
    for (const t of ds[game].tracks) {
      for (const loc of t.locations || []) {
        const enPath: string[] = loc.enPath || loc.resolvedPath || [];
        const zhPath: string[] = loc.zhPath || loc.resolvedZhPath || [];
        if (!enPath.length) continue;
        const catEn = game === 'hsr' ? (loc.kind || 'location') : (loc.dimension || 'location');
        let parentEn: string | null = null;
        for (let i = 0; i < enPath.length; i++) {
          const en = enPath[i];
          const zh = zhPath[i];
          if (zh && zh !== en) {
            out.push({ game_id: gid, catEn, parentEn, en, zh });
          }
          parentEn = en;
        }
      }
    }
  }
  return out;
}

async function main() {
  const dry = !process.argv.includes('--apply');
  const ds = JSON.parse(fs.readFileSync(DATASET, 'utf8'));
  const plan = buildPlan(ds);

  // dedupe by (game, cat, parent, en)
  const seen = new Set<string>();
  const uniq: PlanNode[] = [];
  for (const n of plan) {
    const k = `${n.game_id}|${n.catEn}|${n.parentEn ?? '∅'}|${n.en}`;
    if (!seen.has(k)) { seen.add(k); uniq.push(n); }
  }

  const client = new Client({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  });
  await client.connect();
  try {
    // category id map
    const cats = await client.query(`select id, game_id, name from music_source_categories`);
    const catId = new Map<string, number>();
    for (const c of cats.rows) catId.set(`${c.game_id}|${c.name}`, c.id);

    // node map for parent resolution: (category_id, en_name) -> id
    const nodes = await client.query(`select id, game_id, category_id, parent_id, en_name, translation_status from music_source_nodes`);
    const nodeByCatEn = new Map<string, number>();
    for (const n of nodes.rows) nodeByCatEn.set(`${n.category_id}|${n.en_name}`, n.id);

    let wouldUpdate = 0;
    const byGame: Record<number, number> = { 1: 0, 2: 0 };
    for (const n of uniq) {
      const cid = catId.get(`${n.game_id}|${n.catEn}`);
      if (!cid) continue;
      const pid = n.parentEn ? (nodeByCatEn.get(`${cid}|${n.parentEn}`) ?? null) : null;
      if (dry) {
        // count rows that would match (still pending)
        const r = await client.query(
          `select count(*)::int c from music_source_nodes
           where game_id=$1 and category_id=$2 and en_name=$3 and translation_status='pending'
             and (($4::int is null and parent_id is null) or parent_id=$4)`,
          [n.game_id, cid, n.en, pid]
        );
        if (r.rows[0].c > 0) { wouldUpdate++; byGame[n.game_id] += r.rows[0].c; }
      } else {
        const r = await client.query(
          `update music_source_nodes set name=$5, translation_status='translated', updated_at=now()
           where game_id=$1 and category_id=$2 and en_name=$3 and translation_status='pending'
             and (($4::int is null and parent_id is null) or parent_id=$4)`,
          [n.game_id, cid, n.en, pid, n.zh]
        );
        if (r.rowCount && r.rowCount > 0) { wouldUpdate++; byGame[n.game_id] += r.rowCount; }
      }
    }
    if (dry) {
      console.log(`DRY-RUN: would flip pending->translated: ${wouldUpdate} rows (genshin=${byGame[1]}, hsr=${byGame[2]})`);
    } else {
      console.log(`APPLIED: flipped pending->translated: ${wouldUpdate} rows (genshin=${byGame[1]}, hsr=${byGame[2]})`);
    }
  } finally {
    await client.end();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
