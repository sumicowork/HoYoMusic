import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const CACHE = path.resolve(__dirname, '.cache');

// index cached fandom pages: lowercased title -> parsed infobox/wikitext snippet
function parseOL(wt: string) {
  const m = wt.match(/{{Other Languages([\s\S]*?)}}/i);
  const out: Record<string, string> = {};
  if (!m) return out;
  for (const line of m[1].split(/\n/)) {
    const mm = line.match(/^\s*\|?\s*([a-z0-9_]+)\s*=\s*(.+?)\s*$/i);
    if (mm) { const k = mm[1].toLowerCase().replace(/^\d+_/, ''); out[k] = mm[2].replace(/{{[^}]*}}/g, '').trim(); }
  }
  return out;
}
const pageIndex = new Map<string, { title: string; isSoundtrack: boolean; ol: Record<string, string> }>();
function buildIndex() {
  const files = fs.readdirSync(CACHE).filter((f) => f.endsWith('.json'));
  for (const f of files) {
    let d: any; try { d = JSON.parse(fs.readFileSync(path.join(CACHE, f), 'utf8')); } catch { continue; }
    const p = d?.parse; if (!p || !p.title) continue;
    const wt: string = p.wikitext?.['*'] || '';
    const isSoundtrack = /{{Soundtrack Infobox/i.test(wt) || /Soundtrack/i.test(p.title);
    pageIndex.set(p.title.toLowerCase(), { title: p.title, isSoundtrack, ol: parseOL(wt) });
  }
}
// given a resolved zh, find which page(s) contribute it as OL zhs/zht
function pagesProvidingZh(zh: string) {
  const hits: string[] = [];
  for (const [k, v] of pageIndex) {
    if (v.ol.zhs === zh || v.ol.zht === zh) hits.push(v.title + (v.isSoundtrack ? ' [SOUNDTRACK]' : ''));
  }
  return hits;
}

const client = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });

async function main() {
  await client.connect();
  buildIndex();
  // tracks title_cn -> set, and title_en -> set
  const tr = await client.query(`select id, title_en, title_cn from tracks where title_cn is not null and title_cn<>''`);
  const trMap = new Map<number, { en: string; cn: string }>();
  for (const r of tr.rows) trMap.set(r.id, { en: r.title_en, cn: r.title_cn });

  const n = await client.query(`select id, category_id, en_name, name from music_source_nodes where game_id=2 and translation_status='translated'`);
  const titleCn = new Set<string>(tr.rows.map((r) => r.title_cn));
  const bugs = n.rows.filter((r) => titleCn.has(r.name));

  // character names that could legitimately be a node display name
  const CHAR_NAMES = new Set(['Cyrene', 'Fugue', 'Sunday', 'Robin', 'Ruan Mei', 'Sparkle', 'Black Swan', 'Firefly', 'Acheron', 'The Herta', 'Castorice', 'Phainon', 'Mydei', 'Tribbie', 'Hyacine', 'Aglaea', 'Anaxa', 'Yunli', 'Jade', 'Topaz', 'Ratio', 'Aventurine', 'Dr. Ratio', 'Boothill', 'Lingsha']);

  const rows: string[] = [];
  console.log('id | en_name | name | hit_track_cn | hit_track_en | source_page | verdict');
  console.log('---');
  for (const b of bugs) {
    // find which track this name collides with
    let hitEn = '';
    for (const [, v] of trMap) if (v.cn === b.name) { hitEn = v.en; break; }
    // which fandom page provided this zh
    const prov = pagesProvidingZh(b.name);
    const fromSoundtrack = prov.some((p) => p.includes('[SOUNDTRACK]'));
    let verdict = '';
    if (fromSoundtrack) verdict = 'TRUE-BUG(曲子页误植)';
    else if (CHAR_NAMES.has(b.en_name.trim()) || CHAR_NAMES.has(b.name)) verdict = 'LIKELY-OK(角色名巧合)';
    else if (/Version\s*\d/i.test(b.en_name)) verdict = 'TRUE-BUG(版本号误植歌名)';
    else if (/[|]|showChapter|=0|Mission\s*\|/i.test(b.en_name)) verdict = 'TRUE-BUG(脏模板串)';
    else if (/(Menu|Login|Combat|Concert|Promo|PV|Trailer|Video|TGS|Game Awards)/i.test(b.en_name)) verdict = 'TRUE-BUG(界面/预告片误植歌名)';
    else verdict = 'REVIEW';
    rows.push([b.id, b.en_name, b.name, hitEn, prov.join('|') || '(no fandom page provides this zh)', verdict].join(' || '));
    console.log(`${b.id} | ${b.en_name} | ${b.name} | ${hitEn} | ${prov.join(',') || '-'} | ${verdict}`);
  }
  fs.writeFileSync(path.resolve(__dirname, 'out/hsr_46_crossref.csv'), 'id,en_name,name,hit_track_en,source_pages,verdict\n' + rows.map((r) => r.split(' || ').map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n'));
  console.log('\nwrote out/hsr_46_crossref.csv (' + bugs.length + ' rows)');
  await client.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
