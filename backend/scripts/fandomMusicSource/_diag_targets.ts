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
function isSound(t: string, w: string) { return /soundtrack/i.test(t) || /{{Soundtrack Infobox/i.test(w); }
function pagesZh(zh: string): { ns: number; ss: number } {
  let ns = 0, ss = 0;
  for (const v of cacheByTitle.values()) {
    const m = v.wt.match(/{{Other Languages([\s\S]*?)}}/i); if (!m) continue;
    const o: Record<string, string> = {};
    for (const l of m[1].split(/\n/)) { const mm = l.match(/^\s*\|?\s*([a-z0-9_]+)\s*=\s*(.+?)\s*$/i); if (mm) o[mm[1].toLowerCase().replace(/^\d+_/, '')] = mm[2].replace(/{{[^}]*}}/g, '').trim(); }
    if (o.zhs === zh || o.zht === zh) { if (isSound(v.title, v.wt)) ss++; else ns++; }
  }
  return { ns, ss };
}
const SKIP = new Set([7239, 7408, 7409, 7478]);
const client = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
async function main() {
  await client.connect();
  for (const BAK of ['music_source_nodes_bugfix_bak_1783842493631', 'music_source_nodes_bugfix2_bak_1783842680643']) {
    const all = (await client.query('select id, name, en_name, translation_status from ' + BAK + ' where game_id=2')).rows;
    const trans = all.filter((r: any) => r.translation_status === 'translated');
    const tgt = trans.filter((r: any) => { if (SKIP.has(r.id)) return false; const r2 = pagesZh(r.name); return r2.ss > 0 && r2.ns === 0; }).map((r: any) => r.id);
    console.log('=== ' + BAK + ' ===');
    console.log('  total HSR rows: ' + all.length + ', translated: ' + trans.length);
    console.log('  TRUE-BUG targets (ss>0&&ns===0, excl skip): ' + tgt.length);
    console.log('  ids: ' + tgt.join(', '));
  }
  await client.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
