import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const client = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });

function norm(s: string): string {
  return (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

async function main() {
  await client.connect();
  const data = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'out/music-source-dataset.json'), 'utf8'));

  const cats = (await client.query(`select id, game_id, name, en_name from music_source_categories`)).rows;
  const catByKey = new Map<string, number>();
  for (const c of cats) {
    if (c.name) catByKey.set(`${c.game_id}|${norm(c.name)}`, c.id);
    if (c.en_name) catByKey.set(`${c.game_id}|${norm(c.en_name)}`, c.id);
  }

  const nodes = (await client.query(`select id, game_id, category_id, en_name, translation_status from music_source_nodes`)).rows;
  const nodeByKey = new Map<string, { id: number; status: string }>();
  for (const n of nodes) {
    if (n.en_name) nodeByKey.set(`${n.game_id}|${n.category_id}|${norm(n.en_name)}`, { id: n.id, status: n.translation_status });
  }

  const trackMaps: Record<number, Map<string, number>> = { 1: new Map(), 2: new Map() };
  for (const gid of [1, 2]) {
    const rows = (await client.query(
      `select t.id, t.title_en from tracks t join albums a on t.album_id=a.id join games g on a.game_id=g.id where g.id=$1`,
      [gid]
    )).rows;
    for (const r of rows) if (r.title_en) trackMaps[gid].set(norm(r.title_en), r.id);
  }

  const totTracks = (await client.query(`select count(*) as n from tracks`)).rows[0].n;
  const perGame: Record<string, any> = {};
  const gameFor: Record<string, number> = { genshin: 1, hsr: 2 };

  for (const gkey of ['genshin', 'hsr']) {
    const gid = gameFor[gkey];
    const s = { datasetTracks: 0, matchedTracks: 0, tracksWithEdge: 0, edges: 0, edgesTranslated: 0, edgesPending: 0, unmatchedTrack: 0, unmappedCat: 0, unmatchedNode: 0, noPath: 0 };
    const tracks = data[gkey].tracks as any[];
    for (const t of tracks) {
      s.datasetTracks++;
      const titleEn = norm(t.otherLanguages?.en || t.pageTitle || t.trackTitle || '');
      const trackId = trackMaps[gid].get(titleEn);
      if (!trackId) { s.unmatchedTrack++; continue; }
      s.matchedTracks++;
      const locs = (t.locations || []) as any[];
      let got = false;
      for (const loc of locs) {
        const catKey = loc.kind || loc.dimension;
        const pathArr = loc.resolvedPath || loc.enPath;
        if (!catKey || !pathArr || !pathArr.length) { s.noPath++; continue; }
        const leaf = pathArr[pathArr.length - 1] as string;
        const catId = catByKey.get(`${gid}|${norm(catKey)}`);
        if (!catId) { s.unmappedCat++; continue; }
        const node = nodeByKey.get(`${gid}|${catId}|${norm(leaf)}`);
        if (!node) { s.unmatchedNode++; continue; }
        s.edges++;
        if (node.status === 'translated') s.edgesTranslated++; else s.edgesPending++;
        got = true;
      }
      if (got) s.tracksWithEdge++;
    }
    perGame[gkey] = s;
  }
  await client.end();

  console.log('========== 只读统计：会建多少「歌→地方」连线 ==========');
  console.log(`曲库总曲数(DB): ${totTracks}\n`);
  let totEdges = 0, totTracksEdge = 0, totTrans = 0, totPend = 0;
  for (const gkey of ['genshin', 'hsr']) {
    const s = perGame[gkey];
    totEdges += s.edges; totTracksEdge += s.tracksWithEdge; totTrans += s.edgesTranslated; totPend += s.edgesPending;
    console.log(`--- ${gkey} ---`);
    console.log(`  dataset曲目: ${s.datasetTracks} | 匹配DB曲: ${s.matchedTracks} (未匹配 ${s.unmatchedTrack})`);
    console.log(`  能挂≥1地方的曲: ${s.tracksWithEdge}`);
    console.log(`  连线(边): ${s.edges} | 已译节点 ${s.edgesTranslated} / 待译节点 ${s.edgesPending}`);
    console.log(`  失败: 无路径 ${s.noPath} | 分类映射不到 ${s.unmappedCat} | 节点名匹配不到 ${s.unmatchedNode}\n`);
  }
  console.log(`========== 合计 ==========`);
  console.log(`能挂≥1地方的曲: ${totTracksEdge} (占全库 ${totTracks} 的 ${(totTracksEdge/totTracks*100).toFixed(1)}%)`);
  console.log(`连线总数: ${totEdges} | 已译 ${totTrans} (${(totTrans/totEdges*100).toFixed(1)}%) / 待译 ${totPend} (${(totPend/totEdges*100).toFixed(1)}%)`);
  console.log('\n⚠️ 估算口径：用现有 dataset(早于27误植修复)，靠节点名对不上即丢弃自动排误植；leaf 匹配未走完整父链(同名子节点可能挂错父)。要精确值需重跑解析(~10min)并做路径级匹配。');
}

main().catch((e) => { console.error(e); process.exit(1); });
