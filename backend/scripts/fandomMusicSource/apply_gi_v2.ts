/**
 * apply_gi_v2.ts — 原神 814 条 pending → translated 落库
 *
 * 铁律流程：整表备份(已完成) → dry-run → UPDATE → 验证
 * 只改: name=中文, translation_status='translated'
 * 保留: en_name, category_id, game_id, parent_id 等所有其他字段不动
 *
 * 清洗: HTML 实体 &mdash; → ——, &nbsp; → 空格 等
 */
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const CSV = path.resolve(__dirname, 'out/relookup_gi_v2_fill.csv');

function cleanHtml(s: string): string {
  return s
    .replace(/&mdash;/g, '——')
    .replace(/&ndash;/g, '–')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&hellip;/g, '…')
    .replace(/&[a-z]+;/g, ''); // 兜底：残留实体直接删
}

// CSV parser (handles quoted fields with commas)
function parseCsv(content: string): { id: number; en_name: string; proposed_zh: string; source_title: string }[] {
  const lines = content.trim().split('\n');
  const rows: { id: number; en_name: string; proposed_zh: string; source_title: string }[] = [];
  for (let i = 1; i < lines.length; i++) {
    // state machine for quoted CSV
    const fields: string[] = [];
    let cur = '';
    let inQuote = false;
    for (const ch of lines[i]) {
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === ',' && !inQuote) { fields.push(cur); cur = ''; continue; }
      cur += ch;
    }
    fields.push(cur);
    if (fields.length >= 3) {
      rows.push({
        id: parseInt(fields[0], 10),
        en_name: fields[1],
        proposed_zh: cleanHtml(fields[2]),
        source_title: fields[3] || '',
      });
    }
  }
  return rows;
}

async function main() {
  const csvContent = fs.readFileSync(CSV, 'utf8');
  const rows = parseCsv(csvContent);
  console.log('=== DRY-RUN ===');
  console.log('Total rows to UPDATE:', rows.length);

  // sanity checks
  const ids = rows.map(r => r.id);
  const uniqueIds = new Set(ids);
  console.log('Unique IDs:', uniqueIds.size, '(should equal', rows.length, ')');

  // check for HTML entity cleanup
  const cleaned = rows.filter(r => r.proposed_zh !== rows.find(x => x.id === r.id)!.proposed_zh);
  const htmlFixed = rows.filter(r => {
    const orig = parseCsv(csvContent).find(x => x.id === r.id)!;
    return orig.proposed_zh !== r.proposed_zh;
  });

  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });
  await client.connect();

  // verify these IDs exist and are currently pending
  const idList = ids.join(',');
  const check = await client.query(
    `SELECT id, name, en_name, translation_status FROM music_source_nodes WHERE id = ANY($1::int[])`,
    [ids]
  );
  console.log('IDs found in DB:', check.rows.length);
  const notPending = check.rows.filter((r: any) => r.translation_status !== 'pending');
  if (notPending.length > 0) {
    console.log('⚠️ NOT pending (skipping):', notPending.length);
    notPending.slice(0, 5).forEach((r: any) => console.log(`  id=${r.id} status=${r.translation_status} name=${r.name}`));
  }
  const notFound = ids.filter(id => !check.rows.find((r: any) => r.id === id));
  if (notFound.length > 0) console.log('⚠️ NOT found in DB:', notFound.length, notFound.slice(0, 5));

  // sample changes
  console.log('\n=== SAMPLE CHANGES (first 10) ===');
  for (const r of rows.slice(0, 10)) {
    const dbRow = check.rows.find((x: any) => x.id === r.id);
    console.log(`  id=${r.id}: "${dbRow?.name}" → "${r.proposed_zh}"`);
  }
  console.log('  ...');
  console.log('\n=== SAMPLE CHANGES (last 5) ===');
  for (const r of rows.slice(-5)) {
    const dbRow = check.rows.find((x: any) => x.id === r.id);
    console.log(`  id=${r.id}: "${dbRow?.name}" → "${r.proposed_zh}"`);
  }

  // HTML entity cleanup count
  const rawRows = parseCsv(csvContent);
  const htmlCount = rawRows.filter(r => /&[a-z]+;/.test(r.proposed_zh)).length;
  console.log('\nHTML entities cleaned:', htmlCount);

  // ---- APPLY ----
  console.log('\n=== APPLYING ===');
  let updated = 0;
  for (const r of rows) {
    const res = await client.query(
      `UPDATE music_source_nodes SET name = $1, translation_status = 'translated', updated_at = NOW() WHERE id = $2 AND translation_status = 'pending'`,
      [r.proposed_zh, r.id]
    );
    updated += res.rowCount;
  }
  console.log('Rows UPDATEd:', updated);

  // ---- VERIFY ----
  console.log('\n=== VERIFY ===');
  const giStats = await client.query(`
    SELECT translation_status, count(*) as n
    FROM music_source_nodes WHERE game_id = 1
    GROUP BY translation_status ORDER BY n DESC
  `);
  console.log('原神节点翻译状态:');
  giStats.rows.forEach((r: any) => console.log(`  ${r.translation_status}: ${r.n}`));

  const translated = giStats.rows.find((r: any) => r.translation_status === 'translated');
  const total = giStats.rows.reduce((s: number, r: any) => s + parseInt(r.n), 0);
  if (translated && total > 0) {
    console.log(`\n翻译率: ${translated.n}/${total} = ${(translated.n / total * 100).toFixed(1)}%`);
  }

  await client.end();
  console.log('\n✅ Done.');
}

main().catch(e => { console.error(e); process.exit(1); });
