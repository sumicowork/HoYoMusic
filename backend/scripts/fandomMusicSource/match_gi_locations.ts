/**
 * 1. 清洗 gi_region_tree_en.json（去垃圾、去后缀）
 * 2. 把现有 DB 里 361 个原神 location 根节点 匹配到 地区树
 *    看多少能挂到 Region/Area/Subarea 哪一层
 * 只读，不碰库。输出 out/gi_region_tree_clean.json + 匹配报告
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { Client } from 'pg';
import * as dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, 'out');
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const decode = (s: string) => s.replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#[0-9]+;/g, '');
const cleanAreaName = (s: string) => decode(s).replace(/\s*\(Area\)\s*/g, '').trim();

async function main() {
  const raw = JSON.parse(fs.readFileSync(path.join(OUT, 'gi_region_tree_en.json'), 'utf8'));
  const junkAreas = new Set(['Sign in to edit', 'Subareas', 'World Quest', 'Out of Bounds']);

  // 清洗
  const clean: any = { regions: {} };
  const allSubareaNames = new Set<string>();
  const allAreaNames = new Set<string>();

  for (const [region, rData] of Object.entries(raw.regions) as any) {
    const areas: any = {};
    for (const [area, subs] of Object.entries(rData.areas) as any) {
      const ca = cleanAreaName(area);
      if (junkAreas.has(ca) || ca.length < 2) continue;
      const cleanSubs = (subs as string[])
        .map(decode)
        .filter(s => s.length > 1 && !/MB\)|KB\)/.test(s) && !s.includes('Sign in to edit') && !s.includes(':'))
        .map(s => s.replace(/\s*\(Subarea\)\s*/g, '').trim());
      areas[ca] = cleanSubs;
      allAreaNames.add(ca.toLowerCase());
      cleanSubs.forEach((s: string) => allSubareaNames.add(s.toLowerCase()));
    }
    clean.regions[region] = { areas };
  }

  fs.writeFileSync(path.join(OUT, 'gi_region_tree_clean.json'), JSON.stringify(clean, null, 2));

  // DB 现有节点
  const c = new Client({ host: process.env.DB_HOST, port: +process.env.DB_PORT, database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
  await c.connect();
  const r = await c.query(`SELECT id, name, en_name FROM music_source_nodes WHERE game_id=1 AND category_id=29 AND parent_id IS NULL ORDER BY en_name`);
  await c.end();

  // 匹配
  let matchedArea = 0, matchedSub = 0, unmatched = 0;
  const unmatchedList: string[] = [];
  for (const row of r.rows) {
    const en = (row.en_name || row.name || '').trim();
    const enLower = en.toLowerCase();
    if (allAreaNames.has(enLower)) { matchedArea++; }
    else if (allSubareaNames.has(enLower)) { matchedSub++; }
    else { unmatched++; unmatchedList.push(en); }
  }

  console.log('=== 清洗后地区树 ===');
  let totalAreas = 0, totalSubs = 0;
  for (const [region, rData] of Object.entries(clean.regions) as any) {
    const ac = Object.keys(rData.areas).length;
    let sc = 0; for (const s of Object.values(rData.areas)) sc += (s as string[]).length;
    totalAreas += ac; totalSubs += sc;
    console.log(`  ${region}: ${ac} areas, ${sc} subareas`);
  }
  console.log(`  总计: ${Object.keys(clean.regions).length} regions, ${totalAreas} areas, ${totalSubs} subareas`);

  console.log('\n=== DB 361 个根节点 匹配情况 ===');
  console.log(`  匹配为 Area(中间层): ${matchedArea}`);
  console.log(`  匹配为 Subarea(叶子): ${matchedSub}`);
  console.log(`  未匹配(树里没有): ${unmatched}`);
  console.log(`  匹配率: ${((matchedArea + matchedSub) / r.rows.length * 100).toFixed(1)}%`);

  console.log('\n=== 未匹配样本(前60) ===');
  unmatchedList.slice(0, 60).forEach((u, i) => console.log(`  ${i + 1}. ${u}`));

  // 保存未匹配列表
  fs.writeFileSync(path.join(OUT, 'gi_unmatched_locations.txt'), unmatchedList.join('\n'));
  console.log(`\n未匹配完整列表已存: out/gi_unmatched_locations.txt (${unmatched}条)`);
}

main().catch(e => { console.error(e); process.exit(1); });
