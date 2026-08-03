/**
 * Build track_music_sources edges from the FRESH offline-reparsed dataset
 * (hardened resolver). Matching logic is identical to count_edges_pathlevel.ts
 * (validated). The unmatched tracks/nodes (the "uncertain" ones the user asked
 * to set aside) simply produce no edge here.
 *
 * Safety: table is currently empty; we still (a) pre-backup on --apply and
 * (b) use ON CONFLICT (track_id, node_id) DO NOTHING for idempotency.
 *
 * Usage:
 *   node apply_edges.ts            # dry-run: prints counts + sample rows, no writes
 *   node apply_edges.ts --apply    # backup table, then insert matched edges
 */
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function norm(s: string): string {
  return (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}
function normAgg(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[“”‘’]/g, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const APPLY = process.argv.includes('--apply');

async function main() {
  const client = new Client({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  });
  await client.connect();

  // pre-check: current row count
  const cur = (await client.query(`select count(*) as n from track_music_sources`)).rows[0].n;
  console.log(`[pre-check] track_music_sources currently has ${cur} row(s).`);

  const data = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'out/music-source-dataset.json'), 'utf8'));
  const gameFor: Record<string, number> = { genshin: 1, hsr: 2 };

  const cats = (await client.query(`select id, game_id, name, en_name from music_source_categories`)).rows;
  const catByKey = new Map<string, number>();
  for (const c of cats) {
    if (c.name) catByKey.set(`${c.game_id}|${norm(c.name)}`, c.id);
    if (c.en_name) catByKey.set(`${c.game_id}|${norm(c.en_name)}`, c.id);
  }

  const nodes = (await client.query(`select id, game_id, category_id, en_name, translation_status from music_source_nodes`)).rows;
  const nodeExact = new Map<string, { id: number; status: string }>();
  const nodeByLeaf = new Map<string, { id: number; catId: number; status: string }[]>();
  for (const n of nodes) {
    if (n.en_name) {
      nodeExact.set(`${n.game_id}|${n.category_id}|${norm(n.en_name)}`, { id: n.id, status: n.translation_status });
      const k = `${n.game_id}|${norm(n.en_name)}`;
      const arr = nodeByLeaf.get(k) || [];
      arr.push({ id: n.id, catId: n.category_id, status: n.translation_status });
      nodeByLeaf.set(k, arr);
    }
  }

  const trackMaps: Record<number, Map<string, number>> = { 1: new Map(), 2: new Map() };
  for (const gid of [1, 2]) {
    const rows = (await client.query(
      `select t.id, t.title_en from tracks t join albums a on t.album_id=a.id where a.game_id=$1`, [gid]
    )).rows;
    for (const r of rows) if (r.title_en) trackMaps[gid].set(normAgg(r.title_en), r.id);
  }

  const edges: { track_id: number; game_id: number; category_id: number; node_id: number; display_order: number }[] = [];
  const sample: string[] = [];
  let totTrans = 0, totPend = 0, totTracksEdge = 0;

  for (const gkey of ['genshin', 'hsr']) {
    const gid = gameFor[gkey];
    const tracks = (data[gkey]?.tracks || []) as any[];
    let matched = 0, withEdge = 0;
    for (const t of tracks) {
      const titleEn = normAgg(t.otherLanguages?.en || t.pageTitle || t.trackTitle || '');
      const trackId = trackMaps[gid].get(titleEn);
      if (!trackId) continue;
      matched++;
      const locs = (t.locations || []) as any[];
      let order = 0, got = false;
      for (const loc of locs) {
        const catKey = loc.kind || loc.dimension;
        const pathArr: string[] = loc.resolvedPath || loc.enPath || [];
        if (!catKey || !pathArr.length) continue;
        const leaf = pathArr[pathArr.length - 1] as string;
        let catId = catByKey.get(`${gid}|${norm(catKey)}`);
        if (!catId && catKey === 'version') catId = catByKey.get(`${gid}|promo`);
        if (!catId) continue;
        let node = nodeExact.get(`${gid}|${catId}|${norm(leaf)}`);
        if (!node) {
          const cand = nodeByLeaf.get(`${gid}|${norm(leaf)}`) || [];
          const sameCat = cand.find((c) => c.catId === catId);
          if (sameCat) node = sameCat;
          else if (cand.length) node = cand[0];
        }
        if (!node) {
          const stripped = leaf.replace(/™/g, '').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
          if (stripped && stripped !== leaf) {
            node = nodeExact.get(`${gid}|${catId}|${norm(stripped)}`);
            if (!node) {
              const cand = nodeByLeaf.get(`${gid}|${norm(stripped)}`) || [];
              const sameCat = cand.find((c) => c.catId === catId);
              if (sameCat) node = sameCat;
              else if (cand.length) node = cand[0];
            }
          }
        }
        if (!node) continue;
        order++;
        edges.push({ track_id: trackId, game_id: gid, category_id: catId, node_id: node.id, display_order: order });
        if (node.status === 'translated') totTrans++; else totPend++;
        got = true;
        if (sample.length < 12) sample.push(`track#${trackId} -> node#${node.id} (cat#${catId}, ${node.status})`);
      }
      if (got) { withEdge++; totTracksEdge++; }
    }
    console.log(`[${gkey}] matchedTracks=${matched} tracksWithEdge=${withEdge}`);
  }
  await client.end();

  console.log(`\n========== 拟建边统计（不含对不上的，已按你要求挂起）==========`);
  console.log(`连线(边)总数: ${edges.length}`);
  console.log(`覆盖曲数(≥1边): ${totTracksEdge}`);
  console.log(`边指向 已译节点: ${totTrans} (${(edges.length ? (totTrans / edges.length * 100).toFixed(1) : '0')}%) | 待译节点: ${totPend} (${(edges.length ? (totPend / edges.length * 100).toFixed(1) : '0')}%)`);
  console.log(`\n样本(前12条):`);
  for (const s of sample) console.log(`  ${s}`);

  if (!APPLY) {
    console.log(`\n[dry-run] 未写入任何数据。加 --apply 才真正落库（会先拍备份表）。`);
    return;
  }

  // ---- APPLY ----
  const c2 = new Client({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  });
  await c2.connect();
  const ts = Date.now();
  const bak = `track_music_sources_bak_${ts}`;
  await c2.query(`CREATE TABLE ${bak} AS SELECT * FROM track_music_sources`);
  console.log(`\n[apply] 已拍备份表: ${bak}`);

  // batch insert with ON CONFLICT DO NOTHING (idempotent)
  let inserted = 0;
  const BATCH = 500;
  for (let i = 0; i < edges.length; i += BATCH) {
    const chunk = edges.slice(i, i + BATCH);
    const vals: string[] = [];
    const params: any[] = [];
    let p = 1;
    for (const e of chunk) {
      vals.push(`($${p},$${p + 1},$${p + 2},$${p + 3},$${p + 4})`);
      params.push(e.track_id, e.game_id, e.category_id, e.node_id, e.display_order);
      p += 5;
    }
    const r = await c2.query(
      `INSERT INTO track_music_sources (track_id, game_id, category_id, node_id, display_order) VALUES ${vals.join(',')}
       ON CONFLICT (track_id, node_id) DO NOTHING`,
      params
    );
    inserted += (r.rowCount || 0);
  }
  const final = (await c2.query(`select count(*) as n from track_music_sources`)).rows[0].n;
  console.log(`[apply] 插入 ${inserted} 条新边（跳过 ${edges.length - inserted} 条重复）。track_music_sources 现共 ${final} 条。`);
  await c2.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
