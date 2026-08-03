/**
 * 把从 fandom wiki 抓到的原神地区层级树（gi_region_tree_clean.json）
 * 收进 music_source_nodes（location 分类，cat=29）：
 *   Region(6) → Area(54) → Subarea(835)
 * - 已有节点尽量复用（按 en_name/name 匹配），缺的 INSERT
 * - 复用节点通过 UPDATE parent_id 挂到正确父级
 * - 事务包裹，失败整体回滚
 * 跑完输出「还剩什么」= 建树后仍为根、且不在 6 地区之内的节点
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { Client } from 'pg';
import * as dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, 'out');
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const CAT_LOCATION = 29;
const REGIONS = ['Mondstadt', 'Liyue', 'Inazuma', 'Sumeru', 'Fontaine', 'Natlan'];

const norm = (s: string) => (s || '').toLowerCase().trim();

async function main() {
  const tree = JSON.parse(fs.readFileSync(path.join(OUT, 'gi_region_tree_clean.json'), 'utf8'));
  const c = new Client({ host: process.env.DB_HOST, port: +process.env.DB_PORT, database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
  await c.connect();
  await c.query('BEGIN');

  // 全部 location 节点
  const all = await c.query('SELECT id, name, en_name, parent_id FROM music_source_nodes WHERE game_id=1 AND category_id=$1', [CAT_LOCATION]);
  const rows = all.rows as any[];

  const findExisting = (name: string): number | null => {
    const l = norm(name);
    for (const r of rows) {
      if (norm(r.en_name) === l || norm(r.name) === l) return r.id;
    }
    return null;
  };
  const getRow = (id: number) => rows.find(r => r.id === id);

  const claimed = new Set<number>();
  const stats = {
    regionReuse: 0, regionInsert: 0,
    areaReuse: 0, areaReparent: 0, areaInsert: 0,
    subReuse: 0, subReparent: 0, subInsert: 0,
    subSkippedCollision: 0,
  };

  const regionNodeId: Record<string, number> = {};
  // 1) Regions
  for (const region of REGIONS) {
    let id = findExisting(region);
    if (id != null && !claimed.has(id)) {
      claimed.add(id); stats.regionReuse++;
      const cur = getRow(id)!;
      if (cur.parent_id != null) { await c.query('UPDATE music_source_nodes SET parent_id=NULL, updated_at=NOW() WHERE id=$1', [id]); }
      regionNodeId[region] = id;
    } else {
      const r = await c.query('INSERT INTO music_source_nodes(game_id,category_id,name,en_name,parent_id,display_order,translation_status) VALUES(1,$1,$2,$3,NULL,0,$4) RETURNING id', [CAT_LOCATION, region, region, 'pending']);
      regionNodeId[region] = r.rows[0].id; stats.regionInsert++;
    }
  }

  // 2) Areas
  const areaNodeId: Record<string, number> = {};
  for (const [region, rd] of Object.entries(tree.regions) as any) {
    const rid = regionNodeId[region];
    for (const area of Object.keys(rd.areas)) {
      let id = findExisting(area);
      let nodeId: number;
      if (id != null && !claimed.has(id)) {
        claimed.add(id); stats.areaReuse++;
        const cur = getRow(id)!;
        if (cur.parent_id !== rid) { await c.query('UPDATE music_source_nodes SET parent_id=$1, updated_at=NOW() WHERE id=$2', [rid, id]); stats.areaReparent++; }
        nodeId = id;
      } else if (id != null && claimed.has(id)) {
        // 已被认领（如地区节点），不重复用
        continue;
      } else {
        const r = await c.query('INSERT INTO music_source_nodes(game_id,category_id,name,en_name,parent_id,display_order,translation_status) VALUES(1,$1,$2,$3,$4,0,$5) RETURNING id', [CAT_LOCATION, area, area, rid, 'pending']);
        nodeId = r.rows[0].id; stats.areaInsert++;
      }
      areaNodeId[`${region}||${area}`] = nodeId;
    }
  }

  // 3) Subareas
  for (const [region, rd] of Object.entries(tree.regions) as any) {
    for (const [area, subs] of Object.entries(rd.areas) as any) {
      const aid = areaNodeId[`${region}||${area}`];
      if (aid == null) continue;
      for (const sub of subs as string[]) {
        let id = findExisting(sub);
        if (id != null && !claimed.has(id)) {
          claimed.add(id); stats.subReuse++;
          const cur = getRow(id)!;
          if (cur.parent_id !== aid) { await c.query('UPDATE music_source_nodes SET parent_id=$1, updated_at=NOW() WHERE id=$2', [aid, id]); stats.subReparent++; }
        } else if (id != null && claimed.has(id)) {
          stats.subSkippedCollision++; // 与 area/region 同名，跳过避免重复
          continue;
        } else {
          const r = await c.query('INSERT INTO music_source_nodes(game_id,category_id,name,en_name,parent_id,display_order,translation_status) VALUES(1,$1,$2,$3,$4,0,$5) RETURNING id', [CAT_LOCATION, sub, sub, aid, 'pending']);
          stats.subInsert++;
        }
      }
    }
  }

  await c.query('COMMIT');

  // 4) 还剩什么：建树后仍为根、且不在 6 地区之内
  const remaining = await c.query(
    `SELECT id, name, en_name FROM music_source_nodes
     WHERE game_id=1 AND category_id=$1 AND parent_id IS NULL
       AND en_name NOT IN (${REGIONS.map((_, i) => '$' + (i + 2)).join(',')})
     ORDER BY en_name`,
    [CAT_LOCATION, ...REGIONS]
  );

  console.log('=== 建树统计 ===');
  console.log(`Regions: 复用 ${stats.regionReuse} / 新增 ${stats.regionInsert}`);
  console.log(`Areas:   复用 ${stats.areaReuse} (其中重挂父 ${stats.areaReparent}) / 新增 ${stats.areaInsert}`);
  console.log(`Subareas:复用 ${stats.subReuse} (其中重挂父 ${stats.subReparent}) / 新增 ${stats.subInsert} / 同名跳过 ${stats.subSkippedCollision}`);
  console.log(`\n建树后仍为根、且非 6 地区的节点（还剩什么）: ${remaining.rows.length} 个`);

  fs.writeFileSync(path.join(OUT, 'gi_remaining_after_build.txt'), remaining.rows.map((r: any) => (r.en_name || r.name || '')).join('\n'));
  console.log('剩余清单已存: out/gi_remaining_after_build.txt');

  await c.end();
}

main().catch(async (e) => {
  console.error('ERROR:', e);
  process.exit(1);
});

// 进程异常退出前尝试回滚未提交事务
process.on('uncaughtException', async () => { process.exit(1); });
