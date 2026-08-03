import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Authoritative detector: a node's display zh is a TRUE misplant if it is
// sourced SOLELY from fandom Soundtrack pages (a song title planted as a
// scene name). If any non-soundtrack page (version/character/location) also
// provides that zh, it is correct (name-collision, e.g. version == theme song).
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
    for (const l of m[1].split(/\n/)) { const mm = l.match(/^\s*\|?\s*([a-z0-9_]+)\s*=\s*(.+?)\s*$/i); if (mm) { o[mm[1].toLowerCase().replace(/^\d+_/, '')] = mm[2].replace(/{{[^}]*}}/g, '').trim(); } }
    if (o.zhs === zh || o.zht === zh) { if (isSound(v.title, v.wt)) ss++; else ns++; }
  }
  return { ns, ss };
}

const SKIP = new Set([7239, 7408, 7409, 7478]); // 3 character names + 1 user-review
async function loadTargets(client: Client): Promise<number[]> {
  const all = (await client.query(`select id, name from music_source_nodes where game_id=2 and translation_status='translated'`)).rows;
  return all.filter((r: any) => { if (SKIP.has(r.id)) return false; const { ns, ss } = pagesZh(r.name); return ss > 0 && ns === 0; }).map((r: any) => r.id);
}

const mode = process.argv[2] || '--dry-run';
const client = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });

async function main() {
  await client.connect();
  const targets = await loadTargets(client);
  console.log('TRUE-BUG (zh sourced ONLY from soundtrack pages), excl. skips:', targets.length);
  if (mode === '--apply') {
    const ts = Date.now();
    await client.query(`create table if not exists music_source_nodes_bugfix2_bak_${ts} as select * from music_source_nodes`);
    console.log('[backup] created music_source_nodes_bugfix2_bak_' + ts);
  }
  const rows = (await client.query(`select id, en_name, name from music_source_nodes where id = any($1)`, [targets])).rows;
  console.log('---');
  for (const r of rows) {
    console.log(`#${r.id} | ${r.en_name} | ${r.name} -> (pending) ${r.en_name}`);
    if (mode === '--apply') await client.query(`update music_source_nodes set name=$1, translation_status='pending', updated_at=now() where id=$2`, [r.en_name, r.id]);
  }
  console.log('\nMODE:', mode, mode === '--apply' ? '=> updated ' + rows.length + ' rows' : '=> no changes (dry-run)');
  await client.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
