/**
 * 将已知 INST（纯器乐/credits-only）LRC 对应的 DB track 标记为 instrumental
 * 只包含 agent 逐首验证过的 100% INST 专辑
 * 用法: node scripts/applyInstMarks.cjs [--dry-run] [--apply]
 */
const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');
const { Pool } = require('pg');
require('dotenv').config();

const ARGS = { dryRun: !process.argv.includes('--apply') };

// ── Agent 逐首验证过的 100% INST 专辑 ──
const INST_ALBUMS = [
  // GI OST
  '珍珠之歌', 'The Shimmering Voyage',
  '皎月云间之梦', 'Jade Moon Upon a Sea of Clouds',
  '风与牧歌之城', 'City of Winds and Idylls',
  '风与异乡人', 'Le Vent et les Enfants des etoiles',
  '千岩旷望', 'Milleliths Watch',
  '佚落迁忘之岛', 'Islands of the Lost and Forgotten',
  '啁哳流变之砂', 'The Unfathomable Sand Dunes',
  '寂远无妄之国', 'Realm of Tranquil Eternity',
  '智妙明论之林', 'Forest of Jnana and Vidya',
  '沉玉沐芳', 'Jadeite Redolence',
  '幽暮衬映之月', 'Outside It Is Growing Dark',
  '流星的轨迹', 'Footprints of the Traveler',
  '青灯玉砚', 'Azure Lantern, Jade Inkstone',
  '霄灯映明月', 'When Lanterns Echo the Moon',
  '金律永谐', 'Cantus Aeternus',
  '遥古喁望之阳', 'Eternal Sun, Eternal Want',
  '竟夜有辉之燎', 'Radiance Aflame',
  '飞彩镌流年', 'Fleeting Colors in Flight',
  '华灯星聚', 'Myriad of Lights',
  // GI 万流始源 - 拉丁圣咏除外（agent已验证前19首INST，2首VOCAL，这里只标INST部分）
  '万流始源之海', 'Pelagic Primaevality',
  // GI 朔望凝待 - Boss圣咏除外
  '朔望凝待之庭', 'Where Roads Are Pledged to Cross',

  // HSR OST
  '行于命途', 'Experience the Paths',
  '洞穴寓言', 'Allegory of the Cave',
  '飞来波的圣状', 'The Flapper Sinthome',
  '星空剧场', 'Astral Theater',
  '长生梦短', 'Svah Sanishyu',
  '雪融于烬', 'Of Snow and Ember',
  '神说要有笑', 'Let There Be Laughter',
  '天生鬼才', 'Side Quest King',

  // ToT OST
  '未定事件簿OST', '未定事件簿：契',
];

// ── 匹配 DB ──
function normalize(s) {
  return (s||'').toLowerCase()
    .replace(/[（(].*?[)）]/g, '')
    .replace(/[^a-z0-9\u4e00-\u9fff]/g, '')
    .trim();
}

async function main() {
  const roots = ['D:/CreditDebug', 'D:/补充'];
  const allFiles = [];
  for (const r of roots) {
    if (!fs.existsSync(r)) continue;
    for (const e of fs.readdirSync(r, { recursive: true })) {
      const f = path.join(r, e);
      if (f.endsWith('.lrc') && fs.statSync(f).isFile()) allFiles.push(f);
    }
  }

  // 筛选 INST
  const instFiles = allFiles.filter(f => {
    const dir = path.basename(path.dirname(f));
    return INST_ALBUMS.some(a => dir.includes(a));
  });

  console.log(`📂 总 LRC: ${allFiles.length} | 命中 INST 专辑: ${instFiles.length}`);

  // 连接 DB
  const pool = new Pool({
    host: process.env.DB_HOST, port: process.env.DB_PORT,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const { rows: tracks } = await pool.query(
    `SELECT t.id, t.title, t.title_cn, t.lyrics_status, a.title as album
     FROM tracks t JOIN albums a ON a.id = t.album_id`
  );

  // 匹配 LRC 文件名 → DB track
  let matched = 0, unmatched = 0;
  const updates = [];

  for (const f of instFiles) {
    const fname = path.basename(f, '.lrc');
    const nName = normalize(fname);

    let match = tracks.find(t =>
      normalize(t.title) === nName ||
      normalize(t.title_cn || '') === nName
    );

    if (!match) {
      const short = nName.slice(0, 12);
      match = tracks.find(t =>
        normalize(t.title).includes(short) ||
        normalize(t.title_cn || '').includes(short)
      );
    }

    if (match) {
      updates.push({ id: match.id, title: match.title, album: match.album, lrc: fname });
      matched++;
    } else {
      unmatched++;
    }
  }

  console.log(`🔗 匹配: ${matched} | 未匹配: ${unmatched}`);

  if (ARGS.dryRun) {
    const byAlbum = {};
    updates.forEach(u => { byAlbum[u.album] = (byAlbum[u.album] || 0) + 1; });
    console.log(`\n🏜️  DRY RUN — 将标记 ${updates.length} 首为 instrumental`);
    console.log('   按专辑:', JSON.stringify(byAlbum));
    console.log('\n   前10首:');
    updates.slice(0, 10).forEach(u => console.log(`     #${u.id} ${u.album} / ${u.title}`));
  } else {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        'UPDATE tracks SET lyrics_status = $1 WHERE id = ANY($2::int[])',
        ['instrumental', updates.map(u => u.id)]
      );
      await client.query('COMMIT');
      console.log(`\n✅ 已更新 ${result.rowCount} 个 track → instrumental`);
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('❌', e.message);
    } finally {
      client.release();
    }
  }

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
