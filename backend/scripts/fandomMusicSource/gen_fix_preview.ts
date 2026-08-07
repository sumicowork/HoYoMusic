import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const client = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });

const EN = [
  'A Flash', 'Furbobocom; furbo/Fulwish TV', 'Cosmic Ninjutsu Inscriptions — Havoc Exorcism: Lunar Vileslayer Scroll',
  'Harmony Greets the New Year', 'Ichor of Two Dragons', 'Dialogue cutscenes',
  'Dialogue scenes in A Walk Among the Tombstones and Then Wake to Weep', 'Rondo Across Countless Kalpas',
  'Taking It Easy', 'The Embers of Glamoth', 'The Long Night of Serenity', 'Trek', 'The Game Awards',
  'Concert Animated Commercial: "Before the Show Starts', 'The Reverie (Dreamscape) (Dreamwalker)',
  'Honkai: Star Rail Concert Animated Commercial: "Filming in Progress', 'TGS 2023 Video: Grasp the Stars',
  'Login Menu', 'Parlor Car; Passenger Cabin; Party Car (default music in the Phonograph)', 'Elite Combat', 'Snack Dash (Menu)',
  "T H E H E R T A'S M A G I C K I T C H E N", 'Roots of the Arbor (Demise of Immortality, Finale of Calamity), Pure Fiction',
  'Balcony overlooking Penacony Grand Theater in Golden Hour', "Today Is Yesterday's Tomorrow, When the Stars of Ingenuity Shine",
  'Administrative District (guitarist near Eversummer Florist)', "The duration of the Concerto state when unleashing Robin's Ultimate Vox Harmonique, Opus Cosmique",
];
const BAK = 'music_source_nodes_bugfix_bak_1783842493631';

async function main() {
  await client.connect();
  const ph = EN.map((_, i) => '$' + (i + 1)).join(',');
  const cur = (await client.query(`select id, en_name, name, translation_status from music_source_nodes where translation_status='pending' and en_name in (${ph})`, EN)).rows;
  const bakRows = (await client.query(`select id, name from ${BAK} where en_name in (${ph})`, EN)).rows;
  const bakMap = new Map<number, string>();
  for (const r of bakRows) bakMap.set(r.id, r.name);

  const rows = cur.map((r: any) => ({ id: r.id, en: r.en_name, before: bakMap.get(r.id) || '(n/a)', after: r.name }));
  let html = '<!doctype html><html lang="zh"><head><meta charset="utf-8"><title>HSR 曲名误植修复对比</title><style>';
  html += 'body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f6f8fa;color:#222;padding:24px}h1{font-size:20px}';
  html += 'table{border-collapse:collapse;width:100%;background:#fff;margin-top:12px;font-size:13px}th,td{border:1px solid #e1e4e8;padding:8px 10px;vertical-align:top}';
  html += 'th{background:#f0f3f6}.bad{color:#b00;text-decoration:line-through}.ok{color:#1a7f37;font-weight:600}.en{color:#555;font-family:monospace}';
  html += 'p{font-size:13px;line-height:1.6}.cnt{color:#1a7f37;font-weight:700}</style></head><body>';
  html += '<h1>星铁(HSR)「曲名误植」修复前后对比</h1>';
  html += '<p>共 <span class="cnt">' + rows.length + '</span> 个真 bug。修复前中文是<b class="bad">歌名</b>(误把曲子页当地点页);修复后退回 <b class="ok">pending</b> + 保留英文源(零臆造,待你后续补正确译名)。</p>';
  html += '<table><tr><th>#</th><th>英文源 en_name</th><th>修复前(错误)</th><th>修复后</th><th>状态</th></tr>';
  for (const r of rows) html += `<tr><td>${r.id}</td><td class="en">${r.en}</td><td class="bad">${r.before}</td><td class="ok">${r.after} <small>(pending)</small></td><td>pending</td></tr>`;
  html += '</table></body></html>';
  fs.writeFileSync(path.resolve(__dirname, 'out/hsr_bugfix_preview.html'), html);
  console.log('wrote out/hsr_bugfix_preview.html with', rows.length, 'rows');
  await client.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
