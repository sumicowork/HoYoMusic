/**
 * mergeDupArtists.cjs — 合并近重复 artist 记录
 * 规则: 保留每个组内 track_credits 引用最多的 id，其他合并进去并删除
 * 用法: node mergeDupArtists.cjs [--dry-run]
 */
const { Client } = require('pg');
require('dotenv').config({ path: '/opt/hoyomusic/.env' });

const DB = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};
const DRY_RUN = !process.argv.includes('--apply');

async function main() {
  const client = new Client(DB);
  await client.connect();
  console.log('Connected');

  // ── 1. 找重复组 ──
  const { rows } = await client.query(`
    WITH usage AS (
      SELECT artist_id, count(*) as n FROM track_credits WHERE artist_id IS NOT NULL GROUP BY artist_id
    ),
    stripped AS (
      SELECT a.id, a.name,
        regexp_replace(regexp_replace(lower(a.name), '[@]', '', 'g'), '[[:space:]]+', '', 'g') as clean,
        coalesce(u.n, 0)::int as uses
      FROM artists a LEFT JOIN usage u ON u.artist_id = a.id
    ),
    pairs AS (
      SELECT s1.id as high_id, s1.name as high_name, s1.uses as high_uses,
             s2.id as low_id, s2.name as low_name, s2.uses as low_uses,
             s1.clean
      FROM stripped s1
      JOIN stripped s2 ON s1.clean = s2.clean AND s1.id < s2.id
    )
    SELECT high_id, high_name, high_uses, low_id, low_name, low_uses, clean
    FROM pairs
    ORDER BY high_uses DESC, low_uses DESC
  `);

  console.log(`Found ${rows.length} duplicate pairs\n`);

  // ── 2. 分组 → 每个组最高 usage 的 id = canonical ──
  const groups = {}; // clean → { canonicalId, ids: [{id, name, uses}] }
  for (const r of rows) {
    if (!groups[r.clean]) groups[r.clean] = { ids: new Map(), canonicalId: null, maxUses: -1 };
    const g = groups[r.clean];
    if (!g.ids.has(r.high_id)) g.ids.set(r.high_id, { id: r.high_id, name: r.high_name, uses: r.high_uses });
    if (!g.ids.has(r.low_id)) g.ids.set(r.low_id, { id: r.low_id, name: r.low_name, uses: r.low_uses });
  }

  // 找每个组的 canonical (最高 usage)
  for (const [clean, g] of Object.entries(groups)) {
    let max = 0, canonical = null;
    for (const [id, info] of g.ids) {
      const u = Number(info.uses);  // parseInt — pg 返回 string
      if (u > max) { max = u; canonical = id; }
    }
    g.canonicalId = canonical;
  }

  // ── 3. 执行合并 ──
  let totalMerged = 0;
  for (const [clean, g] of Object.entries(groups)) {
    if (g.ids.size <= 1) continue;
    const canonicalInfo = g.ids.get(g.canonicalId);
    console.log(`Group: "${clean}" → canonical #${g.canonicalId} "${canonicalInfo.name}" (${canonicalInfo.uses} uses)`);
    
    for (const [id, info] of g.ids) {
      if (id === g.canonicalId) continue;
      console.log(`  ← merge #${id} "${info.name}" (${info.uses} uses)`);
      
      if (!DRY_RUN) {
        // 更新 track_credits 引用
        const upd = await client.query('UPDATE track_credits SET artist_id = $1 WHERE artist_id = $2', [g.canonicalId, id]);
        console.log(`    updated ${upd.rowCount} credits`);
        // 删除重复 artist
        await client.query('DELETE FROM artists WHERE id = $1', [id]);
        console.log(`    deleted artist #${id}`);
      } else {
        // dry-run: count credits
        const { rows: cnt } = await client.query('SELECT count(*) as n FROM track_credits WHERE artist_id = $1', [id]);
        console.log(`    would update ${cnt[0].n} credits, delete artist #${id}`);
      }
      totalMerged++;
    }
  }

  console.log(`\n${DRY_RUN ? '[DRY-RUN] Would merge' : 'Merged'} ${totalMerged} duplicate records`);
  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
