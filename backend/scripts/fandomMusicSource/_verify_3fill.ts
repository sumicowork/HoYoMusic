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
function pagesFor(zh: string) {
  const out: { title: string; isSound: boolean }[] = [];
  for (const v of cacheByTitle.values()) {
    const m = v.wt.match(/{{Other Languages([\s\S]*?)}}/i); if (!m) continue;
    const o: Record<string, string> = {};
    for (const l of m[1].split(/\n/)) {
      const mm = l.match(/^\s*\|?\s*([a-z0-9_]+)\s*=\s*(.+?)\s*$/i);
      if (mm) o[mm[1].toLowerCase().replace(/^\d+_/, '')] = mm[2].replace(/{{[^}]*}}/g, '').trim();
    }
    if (o.zhs === zh || o.zht === zh) {
      out.push({ title: v.title, isSound: /soundtrack/i.test(v.title) || /{{Soundtrack Infobox/i.test(v.wt) });
    }
  }
  return out;
}
const client = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
async function main() {
  await client.connect();
  for (const id of [7436, 7474, 7482]) {
    const cur = (await client.query('select id,name,en_name,translation_status from music_source_nodes where id=$1', [id])).rows[0];
    console.log(`\n=== #${id} ===`);
    console.log(`  DB now: name=${JSON.stringify(cur.name)} | en_name=${JSON.stringify(cur.en_name)} | status=${cur.translation_status}`);
    for (const zh of [cur.name]) {
      if (!zh) continue;
      const srcs = pagesFor(zh as string);
      console.log(`  zh="${zh}" provided by ${srcs.length} page(s):`);
      for (const s of srcs) console.log(`    - ${s.isSound ? '[SOUNDTRACK✗]' : '[OK]'} ${s.title}`);
    }
  }
  await client.end();
}
main().catch(e => { console.error(e); process.exit(1); });
