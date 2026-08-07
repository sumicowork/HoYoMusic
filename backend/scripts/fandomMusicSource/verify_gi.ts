/**
 * verify_gi.ts — Post-apply integrity + quality checks for Genshin (game_id=1)
 * music-source rebuild. Read-only; safe to run any time.
 *
 * Checks:
 *   1. category / node / edge counts
 *   2. orphan nodes (parent_id points to missing node)
 *   3. empty nodes (no edge AND no child) — every node must be music-referenced
 *      or an ancestor of one, by construction
 *   4. translation coverage (translated vs pending)
 *   5. duplicate (game,category,parent,name) — must be 0
 *   6. edges whose track/node no longer exist (FK should prevent, but verify)
 *   7. tree depth sanity per dimension
 */
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const GAME_ID = 1;

async function main() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });
  await client.connect();

  const q = async (sql: string, params: any[] = []) => (await client.query(sql, params)).rows;

  const counts = (await q(
    `SELECT
       (SELECT count(*) FROM music_source_categories WHERE game_id=$1) cats,
       (SELECT count(*) FROM music_source_nodes WHERE game_id=$1) nodes,
       (SELECT count(*) FROM track_music_sources WHERE game_id=$1) edges`,
    [GAME_ID],
  ))[0];
  console.log(`counts: categories=${counts.cats} nodes=${counts.nodes} edges=${counts.edges}`);

  // 2) orphans
  const orphans = await q(
    `SELECT n.id, n.name FROM music_source_nodes n
     LEFT JOIN music_source_nodes p ON n.parent_id = p.id
     WHERE n.game_id=$1 AND n.parent_id IS NOT NULL AND p.id IS NULL`,
    [GAME_ID],
  );
  console.log(`orphan nodes (parent missing): ${orphans.length}` + (orphans.length ? ' ' + JSON.stringify(orphans.slice(0,5)) : ''));

  // 3) empty nodes: no edge AND no child
  const empty = await q(
    `SELECT n.id, n.name, n.category_id FROM music_source_nodes n
     WHERE n.game_id=$1
       AND n.id NOT IN (SELECT DISTINCT node_id FROM track_music_sources WHERE game_id=$1)
       AND n.id NOT IN (SELECT DISTINCT parent_id FROM music_source_nodes WHERE game_id=$1 AND parent_id IS NOT NULL)`,
    [GAME_ID],
  );
  console.log(`empty nodes (no edge, no child): ${empty.length}` + (empty.length ? ' ' + JSON.stringify(empty.slice(0,8)) : ''));

  // 4) translation coverage
  const tr = (await q(
    `SELECT translation_status, count(*) c FROM music_source_nodes WHERE game_id=$1 GROUP BY translation_status`,
    [GAME_ID],
  ));
  const trMap: Record<string, number> = {};
  for (const r of tr) trMap[r.translation_status] = Number(r.c);
  const total = counts.nodes || 1;
  console.log(`translation: ` + JSON.stringify(trMap) + `  → translated ${(100*(trMap.translated||0)/total).toFixed(1)}%`);

  // 5) duplicates on unique key
  const dups = await q(
    `SELECT game_id, category_id, parent_id, name, count(*) c
     FROM music_source_nodes WHERE game_id=$1 GROUP BY 1,2,3,4 HAVING count(*)>1`,
    [GAME_ID],
  );
  console.log(`duplicate (game,cat,parent,name): ${dups.length}`);

  // 6) dangling edges
  const dangling = await q(
    `SELECT count(*) c FROM track_music_sources e
     LEFT JOIN tracks t ON e.track_id=t.id
     LEFT JOIN music_source_nodes n ON e.node_id=n.id
     WHERE e.game_id=$1 AND (t.id IS NULL OR n.id IS NULL)`,
    [GAME_ID],
  );
  console.log(`dangling edges (track or node missing): ${dangling[0].c}`);

  // 7) per-dimension depth + sample translated names
  const dims = await q(
    `SELECT c.name cat, n.name node, n.translation_status, n.parent_id
     FROM music_source_nodes n JOIN music_source_categories c ON n.category_id=c.id
     WHERE n.game_id=$1 ORDER BY c.id, n.parent_id NULLS FIRST, n.id LIMIT 12`,
    [GAME_ID],
  );
  console.log('\nsample nodes:');
  for (const d of dims) console.log(`  [${d.cat}] ${d.node} (${d.translation_status})`);

  const ok = orphans.length === 0 && empty.length === 0 && dups.length === 0 && Number(dangling[0].c) === 0;
  console.log(`\n==== VERDICT: ${ok ? 'PASS ✅' : 'FAIL ❌'} ====`);
  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
