/* 诊断：31 个空节点为什么没有书（边）。
 * 复刻 pipeline_gi.ts 的 normAgg / normalizeOne，反查数据集 + 数据库。
 */
require('dotenv').config({ path: '.env' });
const fs = require('fs');
const { Client } = require('pg');

// ---- 复刻 pipeline 的归一化逻辑 ----
const DIMENSION_META = {
  location: { rule: 'geo' }, quest: { rule: 'firstOnly' }, domain: { rule: 'firstOnly' },
  eventgameplay: { rule: 'firstOnly' }, teapot: { rule: 'geo' }, mediaoriginal: { rule: 'asis' },
  special: { rule: 'firstOnly' }, special_displayed: { rule: 'firstOnly' },
};
const SPLIT_SLASH_DIMS = new Set(['eventgameplay', 'special', 'special_displayed']);
const PAREN_RE = /\s*\([^)]*\)\s*/g;
function stripParen(seg) {
  const m = seg.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  if (m) return { name: m[1].trim(), paren: m[2].trim() };
  return { name: seg.trim(), paren: null };
}
function isConditionSegment(seg) {
  if (seg.includes(';')) return true;
  if (/^\d{4}-\d{2}-\d{2}$/.test(seg)) return true;
  if (/^(day|night|all times|all day|rain|wind|snow|storm|combat|phase\s*\d+|near\b|during\b|after\b|before\b|snippet|challenge|challenges|all challenges|cutscene|showdown|trial|test run|boss|enemy|co-?op)\b/i.test(seg)) return true;
  return false;
}
function normAgg(s) {
  return (s || '').toLowerCase().replace(/[“”‘’]/g, '').replace(/\([^)]*\)/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}
function normalizeOne(loc) {
  const dim = loc.dimension || loc.kind || '';
  const meta = DIMENSION_META[dim];
  if (!meta) return { dimension: dim, cleanPath: [], affix: null };
  const segs = (loc.enPath || []).map((s) => (s || '').trim()).filter(Boolean).map(stripParen);
  let expandedSegs = segs;
  if (SPLIT_SLASH_DIMS.has(dim)) {
    expandedSegs = [];
    for (const s of segs) {
      const parts = s.name.split('/').map((x) => x.trim()).filter(Boolean);
      parts.forEach((p, i) => expandedSegs.push({ name: p, paren: i === 0 ? s.paren : null }));
    }
  }
  const affixParts = [];
  for (const s of expandedSegs) if (s.paren) affixParts.push(s.paren);
  let clean;
  if (meta.rule === 'asis') clean = expandedSegs.map((s) => s.name);
  else if (meta.rule === 'firstOnly') {
    clean = expandedSegs.length ? [expandedSegs[0].name] : [];
    if (expandedSegs.length > 1) for (const s of expandedSegs.slice(1)) affixParts.push(s.paren ? `${s.name} (${s.paren})` : s.name);
  } else {
    clean = []; let hit = false;
    for (const s of expandedSegs) {
      if (!hit && isConditionSegment(s.name)) hit = true;
      if (hit) affixParts.push(s.paren ? `${s.name} (${s.paren})` : s.name);
      else clean.push(s.name);
    }
  }
  return { dimension: dim, cleanPath: clean, affix: affixParts.length ? affixParts.join('; ') : null };
}

(async () => {
  const c = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.DB_USER, password: String(process.env.DB_PASSWORD) });
  await c.connect();

  // 1) 31 个空节点
  const empty = await c.query(`
    SELECT mn.id, mn.name, mn.en_name, mc.name AS cat_zh, mc.en_name AS cat_en,
           (SELECT m.name FROM music_source_nodes m WHERE m.id=mn.parent_id) AS parent
    FROM music_source_nodes mn
    JOIN music_source_categories mc ON mc.id=mn.category_id
    WHERE mn.game_id=1
      AND NOT EXISTS (SELECT 1 FROM track_music_sources t WHERE t.node_id=mn.id)
      AND NOT EXISTS (SELECT 1 FROM music_source_nodes ch WHERE ch.parent_id=mn.id)
    ORDER BY mc.name, mn.name`);
  console.log(`空节点总数: ${empty.rows.length}\n`);

  // 2) DB trackMap (game_id=1)
  const tr = await c.query(`SELECT t.id, t.title_en FROM tracks t JOIN albums a ON t.album_id=a.id WHERE a.game_id=$1`, [1]);
  const trackMap = new Map();
  for (const r of tr.rows) if (r.title_en) trackMap.set(normAgg(r.title_en), r.id);

  // 3) 数据集
  const ds = JSON.parse(fs.readFileSync('scripts/fandomMusicSource/out/music-source-dataset.json', 'utf8'));
  const tracks = ds.genshin.tracks;
  console.log(`数据集 genshin 曲数: ${tracks.length} | DB(game_id=1) 曲数: ${tr.rows.length}\n`);

  // 4) 反查每个空节点
  const CAT_EN_TO_DIM = {
    Location: 'location', Quest: 'quest', Domain: 'domain', 'Event Gameplay': 'eventgameplay',
    'Serenitea Pot': 'teapot', 'Media Original': 'mediaoriginal', Special: 'special', 'Special Displayed': 'special_displayed',
  };
  let missingInDb = 0, foundInDb = 0;
  for (const node of empty.rows) {
    const dimKey = CAT_EN_TO_DIM[node.cat_en] || node.cat_en.toLowerCase();
    const matches = [];
    for (const t of tracks) {
      const locs = t.locations || [];
      const trackTitle = normAgg(t.otherLanguages?.en || t.pageTitle || t.trackTitle || '');
      for (const loc of locs) {
        const n = normalizeOne(loc);
        if (n.dimension === dimKey && n.cleanPath.length && n.cleanPath[n.cleanPath.length - 1] === node.en_name) {
          const inDb = trackMap.has(trackTitle);
          matches.push({ title: t.otherLanguages?.en || t.pageTitle || t.trackTitle, inDb, trackTitle });
        }
      }
    }
    const anyInDb = matches.some((m) => m.inDb);
    if (anyInDb) foundInDb++; else missingInDb++;
    console.log(`[${node.cat_zh}] ${node.name}${node.parent ? '  (父:' + node.parent + ')' : ''}`);
    if (matches.length === 0) {
      console.log(`    → 数据集里根本没有以它为叶子节点的曲子（纯孤立节点）`);
    } else {
      const inDbCount = matches.filter((m) => m.inDb).length;
      console.log(`    → 数据集 ${matches.length} 首曲子指向它；其中 ${inDbCount} 首在 DB 能匹配上，但有 ${matches.length - inDbCount} 首匹配不上(书名对不上/库里没有)`);
      matches.slice(0, 4).forEach((m) => console.log(`       - ${JSON.stringify(m.title)}  | DB匹配:${m.inDb}  | norm:"${m.trackTitle}"`));
    }
  }
  console.log(`\n=== 汇总 ===`);
  console.log(`空节点中: 数据集有对应曲子且至少1首能在DB匹配=${foundInDb} | 全部匹配不上/数据集无对应=${missingInDb}`);
  await c.end();
})().catch((e) => { console.error('ERR', e); process.exit(1); });
