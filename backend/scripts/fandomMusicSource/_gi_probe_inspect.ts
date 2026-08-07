import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const CACHE = path.resolve(__dirname, '.cache');
const cacheByTitle = new Map<string, { title: string; wt: string }>();
for (const f of fs.readdirSync(CACHE).filter((x) => x.endsWith('.json'))) {
  let d: any; try { d = JSON.parse(fs.readFileSync(path.join(CACHE, f), 'utf8')); } catch { continue; }
  const p = d?.parse; if (!p || !p.title) continue;
  cacheByTitle.set(p.title.toLowerCase(), { title: p.title, wt: p.wikitext?.['*'] || '' });
}
function otherLangZh(wt: string): string {
  const m = wt.match(/{{Other Languages([\s\S]*?)}}/i); if (!m) return '';
  const o: Record<string, string> = {};
  for (const l of m[1].split(/\n/)) {
    const mm = l.match(/^\s*\|?\s*([a-z0-9_]+)\s*=\s*(.+?)\s*$/i);
    if (mm) o[mm[1].toLowerCase().replace(/^\d+_/, '')] = mm[2].replace(/{{[^}]*}}/g, '').trim();
  }
  return o.zhs || o.zht || '';
}
async function main() {
  const client = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
  await client.connect();
  const rows = (await client.query(`select id, name, en_name, category_id from music_source_nodes where game_id=1 and translation_status='pending' limit 8`)).rows;
  console.log('=== 原神 pending 样本(8) ===');
  for (const r of rows) {
    const en = (r.en_name || r.name || '').trim();
    const hit = cacheByTitle.get(en.toLowerCase());
    const zh = hit ? otherLangZh(hit.wt) : '';
    const hasOL = hit ? /{{Other Languages/i.test(hit.wt) : false;
    console.log(`  #${r.id} en_name="${en}" | cache命中=${hit?hit.title:'(无)'} | hasOtherLang=${hasOL} | zhs="${zh}"`);
  }
  // how many genshin cache pages total + how many have Other Languages
  let giPages = 0, giOL = 0;
  for (const v of cacheByTitle.values()) { if (/soundtrack/i.test(v.title)) continue; if (/{{Other Languages/i.test(v.wt)) giOL++; giPages++; }
  console.log(`\n缓存非歌曲页总数: ${giPages}, 其中带OtherLanguages的: ${giOL}`);
  await client.end();
}
main().catch(e=>{console.error(e);process.exit(1);});
