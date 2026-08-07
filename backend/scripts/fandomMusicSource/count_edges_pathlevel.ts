/**
 * Definitive (read-only) edge-count for track_music_sources, using the FRESH
 * offline-reparsed dataset (hardened resolver) + robust matching:
 *   - track: aggressive title normalization (strip quotes / (subtitles) / punct)
 *   - category: kind (HSR) or dimension (Genshin), with version->promo fallback
 *   - node: exact (game|cat|leaf) then fuzzy (game|leaf across cats)
 * No DB writes. Prints a full breakdown so we can see exactly where any loss is.
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
    .replace(/[""'""'']/g, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  const client = new Client({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  });
  await client.connect();

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

  const totTracks = (await client.query(`select count(*) as n from tracks`)).rows[0].n;
  const perGame: Record<string, any> = {};

  for (const gkey of ['genshin', 'hsr']) {
    const gid = gameFor[gkey];
    const s = {
      datasetTracks: 0, matchedTracks: 0, unmatchedTracks: 0, withLocation: 0, tracksWithEdge: 0,
      edges: 0, edgesTranslated: 0, edgesPending: 0, noPath: 0, unmappedCat: 0,
      versionFallback: 0, unmatchedNode: 0, nodeFuzzy: 0,
      sampleUnmatched: [] as string[],
    };
    const tracks = (data[gkey]?.tracks || []) as any[];
    for (const t of tracks) {
      s.datasetTracks++;
      const titleEn = normAgg(t.otherLanguages?.en || t.pageTitle || t.trackTitle || '');
      const trackId = trackMaps[gid].get(titleEn);
      if (!trackId) { s.unmatchedTracks++; continue; }
      s.matchedTracks++;
      const locs = (t.locations || []) as any[];
      let hasLoc = false, got = false;
      for (const loc of locs) {
        const catKey = loc.kind || loc.dimension;
        const pathArr: string[] = loc.resolvedPath || loc.enPath || [];
        if (!catKey || !pathArr.length) { s.noPath++; continue; }
        hasLoc = true;
        const leaf = pathArr[pathArr.length - 1] as string;
        let catId = catByKey.get(`${gid}|${norm(catKey)}`);
        if (!catId && catKey === 'version') { catId = catByKey.get(`${gid}|promo`); if (catId) s.versionFallback++; }
        if (!catId) { s.unmappedCat++; continue; }
        let node = nodeExact.get(`${gid}|${catId}|${norm(leaf)}`);
        if (!node) {
          const cand = nodeByLeaf.get(`${gid}|${norm(leaf)}`) || [];
          const sameCat = cand.find((c) => c.catId === catId);
          if (sameCat) { node = sameCat; s.nodeFuzzy++; }
          else if (cand.length) { node = cand[0]; s.nodeFuzzy++; }
        }
        // 3rd attempt: strip parenthetical disambiguation / ™ from the leaf
        // (e.g. "Golden Hour (Aideen Park)" -> node "Golden Hour")
        if (!node) {
          const stripped = leaf.replace(/™/g, '').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
          if (stripped && stripped !== leaf) {
            node = nodeExact.get(`${gid}|${catId}|${norm(stripped)}`);
            if (!node) {
              const cand = nodeByLeaf.get(`${gid}|${norm(stripped)}`) || [];
              const sameCat = cand.find((c) => c.catId === catId);
              if (sameCat) { node = sameCat; s.nodeFuzzy++; }
              else if (cand.length) { node = cand[0]; s.nodeFuzzy++; }
            }
          }
        }
        if (!node) { s.unmatchedNode++; if (s.sampleUnmatched.length < 6) s.sampleUnmatched.push(`${catKey}:${leaf}`); continue; }
        s.edges++;
        if (node.status === 'translated') s.edgesTranslated++; else s.edgesPending++;
        got = true;
      }
      if (hasLoc) s.withLocation++;
      if (got) s.tracksWithEdge++;
    }
    perGame[gkey] = s;
  }
  await client.end();

  console.log('========== 精确统计（加固版 resolver + 鲁棒匹配，只读）==========');
  console.log(`曲库总曲数(DB): ${totTracks}\n`);
  let totEdges = 0, totTracksEdge = 0, totTrans = 0, totPend = 0, totMatched = 0, totUnmatched = 0;
  for (const gkey of ['genshin', 'hsr']) {
    const s = perGame[gkey];
    totEdges += s.edges; totTracksEdge += s.tracksWithEdge; totTrans += s.edgesTranslated; totPend += s.edgesPending;
    totMatched += s.matchedTracks; totUnmatched += s.unmatchedTracks;
    console.log(`--- ${gkey} ---`);
    console.log(`  dataset曲目: ${s.datasetTracks} | 匹配DB曲: ${s.matchedTracks} | 库里无(fandom独有): ${s.unmatchedTracks}`);
    console.log(`  匹配曲中带地点标注: ${s.withLocation} | 实际能挂≥1边: ${s.tracksWithEdge}`);
    console.log(`  连线(边): ${s.edges} | 已译节点 ${s.edgesTranslated} (${s.edges>0?(s.edgesTranslated/s.edges*100).toFixed(1):'0'}%) / 待译 ${s.edgesPending}`);
    console.log(`  失败: 无路径 ${s.noPath} | 分类映射不到 ${s.unmappedCat} | version→promo兜底 ${s.versionFallback} | 节点名匹配不到(含模糊救回 ${s.nodeFuzzy}) ${s.unmatchedNode}`);
    if (s.sampleUnmatched.length) console.log(`    未匹配节点样本: ${s.sampleUnmatched.join(' | ')}`);
    console.log('');
  }
  console.log('========== 合计 ==========');
  console.log(`匹配DB曲(可建边候选): ${totMatched} | fandom独有(库无): ${totUnmatched}`);
  console.log(`能挂≥1边的曲: ${totTracksEdge} (占全库 ${totTracks} 的 ${(totTracksEdge/totTracks*100).toFixed(1)}%)`);
  console.log(`连线总数: ${totEdges} | 已译节点 ${totTrans} (${(totEdges>0?(totTrans/totEdges*100).toFixed(1):'0')}%) / 待译 ${totPend} (${(totEdges>0?(totPend/totEdges*100).toFixed(1):'0')}%)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
