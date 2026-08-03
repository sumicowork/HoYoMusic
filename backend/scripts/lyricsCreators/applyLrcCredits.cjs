/**
 * applyLrcCredits.cjs — 将 v13 lrc 抽取结果写入 production 库 track_credits 表。
 *
 * 设计（与项目铁律一致）：
 *  - 默认 --dry-run：只计算并打印将要执行的计划，不碰库。
 *  - --apply 才真正写入，且必须在已 pg_dump 备份的前提下运行。
 *  - 幂等：对 1311 个匹配到的 track_id 先 DELETE 旧 credits 再 INSERT 新抽取结果，
 *    避免重复行，也把旧的（中文-only 角色）刷新为 v13（双语角色）抽取。
 *  - artist_id 回查：credit_value（人名）精确 / 剥尾括号后 双重匹配 artists 表，
 *    最大化保留「创作者→artists 表」关联（站点的核心卖点），匹配不到则留 NULL（下游任务）。
 *
 * 用法：
 *   node applyLrcCredits.cjs                 # dry-run 预览
 *   node applyLrcCredits.cjs --apply         # 真正写入（需先备份）
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('C:/Users/sumi/WebstormProjects/HoYoMusic/backend/node_modules/pg');

const CREDIT_JSON = 'C:/Users/sumi/AppData/Local/Temp/hoyomusic_lrc_read/after_fix_v13.json';
const MATCH_JSON = path.join(__dirname, 'lrc_track_match.json');
const DB = { host: 'localhost', port: 5432, user: 'postgres', password: '2738744rcx', database: 'hoyomusic_import' };

const APPLY = process.argv.includes('--apply');

/** 剥掉尾部括号组（半角/全角），用于 artists 表回查归一。 */
function stripParen(s) {
  return s
    .replace(/[（(][^（）()]*[）)]\s*$/g, '') // 反复剥最外层尾括号
    .replace(/[（(][^（）()]*[）)]\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  const cred = JSON.parse(fs.readFileSync(CREDIT_JSON, 'utf8'));
  const match = JSON.parse(fs.readFileSync(MATCH_JSON, 'utf8'));

  // file -> credits[]
  const creditByFile = new Map(cred.map((x) => [x.file, x.parse.credits]));

  // 组装待插入行：先按 track_id 聚合（一个 track 可能匹配多个 lrc 文件，
  // 如同一首曲子在 `GI上传用\` 与 `LRC\GI上传用\` 两个镜像目录各存一份），
  // 再于 track 内对 (credit_key, credit_value) 去重，避免镜像副本产生的重复行。
  const byTrack = new Map(); // trackId -> [{credit_key, credit_value}]
  const matchedButNoCred = [];
  for (const m of match) {
    const credits = creditByFile.get(m.file);
    if (!credits || credits.length === 0) {
      matchedButNoCred.push(m.file);
      continue;
    }
    if (!byTrack.has(m.trackId)) byTrack.set(m.trackId, new Map()); // key "k|v" -> {credit_key, credit_value}
    const seen = byTrack.get(m.trackId);
    for (const c of credits) {
      if (!c.roleRaw || !c.name) continue;
      const sig = `${c.roleRaw}|${c.name}`;
      if (!seen.has(sig)) seen.set(sig, { credit_key: c.roleRaw, credit_value: c.name });
    }
  }

  const rows = []; // {trackId, credit_key, credit_value, display_order}
  let rawCreditCount = 0;
  for (const m of match) {
    const credits = creditByFile.get(m.file);
    if (credits) rawCreditCount += credits.filter((c) => c.roleRaw && c.name).length;
  }
  for (const [trackId, seen] of byTrack) {
    let i = 0;
    for (const v of seen.values()) {
      rows.push({ trackId, credit_key: v.credit_key, credit_value: v.credit_value, display_order: i++ });
    }
  }

  const client = new Client(DB);
  await client.connect();

  // 加载 artists：name -> id（精确 + 剥尾括号双重键）
  const artRes = await client.query('SELECT id, name FROM artists');
  const artistByName = new Map();
  for (const r of artRes.rows) {
    artistByName.set(r.name, r.id);
    const s = stripParen(r.name);
    if (s && s !== r.name) artistByName.set(s, r.id);
  }

  let resolved = 0;
  for (const row of rows) {
    let aid = artistByName.get(row.credit_value);
    if (aid == null) aid = artistByName.get(stripParen(row.credit_value));
    row.artist_id = aid != null ? aid : null;
    if (aid != null) resolved++;
  }

  const matchedIds = [...new Set(match.map((m) => m.trackId))];

  console.log('\n════════ LRC→track_credits 落库计划 ════════');
  console.log(`模式           : ${APPLY ? 'APPLY（真实写入）' : 'DRY-RUN（仅预览）'}`);
  console.log(`匹配 lrc 文件数: ${match.length}  →  去重后 distinct track 数: ${matchedIds.length}`);
  console.log(`原始 credit 行 : ${rawCreditCount} 行 (含镜像副本重复)`);
  console.log(`去重后待插入  : ${rows.length} 行 (同 track 内 (角色,名字) 去重，剔除 ${rawCreditCount - rows.length} 重复)`);
  console.log(`  - artist_id 已解析 : ${resolved} 行 (${((resolved / rows.length) * 100).toFixed(1)}%)`);
  console.log(`  - artist_id 留 NULL : ${rows.length - resolved} 行 (下游任务补全)`);
  console.log(`匹配但 0 credits : ${matchedButNoCred.length} 个`);
  console.log(`将 DELETE 旧 credits 的 track_id 范围: ${matchedIds.length} 个（幂等刷新）`);
  // 按游戏分布
  const byGame = {};
  for (const m of match) byGame[m.gameId] = (byGame[m.gameId] || 0) + 1;
  console.log('匹配 track 按 gameId 分布:', JSON.stringify(byGame));
  const byType = {};
  for (const m of match) byType[m.matchType] = (byType[m.matchType] || 0) + 1;
  console.log('匹配方式分布:', JSON.stringify(byType));
  console.log('════════════════════════════════════════════');

  if (!APPLY) {
    console.log('（DRY-RUN 结束，未修改数据库。加 --apply 执行真实写入。）');
    await client.end();
    return;
  }

  // 真实写入：单事务
  await client.query('BEGIN');
  try {
    const delRes = await client.query('DELETE FROM track_credits WHERE track_id = ANY($1)', [matchedIds]);
    console.log(`\n[DELETE] 删除旧 credits 行数: ${delRes.rowCount}`);

    // 批量插入
    let inserted = 0;
    const BATCH = 500;
    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk = rows.slice(i, i + BATCH);
      const placeholders = [];
      const params = [];
      let p = 1;
      for (const r of chunk) {
        placeholders.push(`($${p++}, $${p++}, $${p++}, $${p++}, $${p++})`);
        params.push(r.trackId, r.credit_key, r.credit_value, r.display_order, r.artist_id);
      }
      const sql = `INSERT INTO track_credits (track_id, credit_key, credit_value, display_order, artist_id) VALUES ${placeholders.join(', ')}`;
      const res = await client.query(sql, params);
      inserted += res.rowCount;
    }
    console.log(`[INSERT] 新插入 credits 行数: ${inserted}`);
    await client.query('COMMIT');
    console.log('✅ 事务已提交。');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ 写入失败，已回滚：', e.message);
    await client.end();
    process.exit(1);
  }

  // 写入后核查
  const after = await client.query(
    'SELECT count(*) AS n, count(artist_id) AS with_artist FROM track_credits WHERE track_id = ANY($1)',
    [matchedIds],
  );
  console.log(`\n[VERIFY] 这 ${matchedIds.length} 个 track 现有 credits 总数=${after.rows[0].n}, 含 artist_id=${after.rows[0].with_artist}`);
  const total = await client.query('SELECT count(*) AS n FROM track_credits');
  console.log(`[VERIFY] track_credits 全表当前总行数=${total.rows[0].n}`);

  await client.end();
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
