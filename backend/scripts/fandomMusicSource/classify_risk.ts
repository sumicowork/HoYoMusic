/**
 * Second pass (DB-backed, robust): classify the RISK_WRONGENTITY rows.
 * Pull name/en_name straight from DB by id; classify source page by checking
 * whether the fandom source page title (or the node's zh `name`) is actually a
 * TRACK (song/short/collab/theme) rather than the music-source entity.
 */
import fs from 'fs';
import path from 'path';
import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const CSV = path.join(__dirname, 'out', 'translation_audit_flagged.csv');

async function main() {
  // ids of RISK_WRONGENTITY rows
  const ids = fs.readFileSync(CSV, 'utf8').split('\n')
    .filter((l) => l.includes('RISK_WRONGENTITY'))
    .map((l) => parseInt(l.match(/^\s*"?(\d+)"?/)?.[1] || '0', 10))
    .filter((n) => n > 0);
  console.log(`RISK_WRONGENTITY ids: ${ids.length}`);

  const client = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
  await client.connect();

  // track title sets (en + cn)
  const tr = await client.query(`select title, title_en, title_cn from tracks`);
  const trackEn = new Set<string>();
  const trackCn = new Set<string>();
  for (const r of tr.rows) {
    if (r.title_en) trackEn.add(r.title_en.trim().toLowerCase());
    if (r.title) trackEn.add(r.title.trim().toLowerCase());
    if (r.title_cn) trackCn.add(r.title_cn.trim());
  }

  // fetch the flagged nodes
  const { rows } = await client.query(
    `select id, game_id, en_name, name from music_source_nodes where id = ANY($1)`, [ids]);

  const TRACK_PAGE_RE = /(animated short|theme song|soundtrack|single|ost|opening|ending|insert song|music video|promo single|trailer)/i;
  const COLLAB_RE = /(collab|collaboration|联动|benefits overview|福利一览)/i;

  const bug: any[] = [];
  const ok: any[] = [];
  for (const r of rows) {
    const en = (r.en_name || '').trim();
    const zh = (r.name || '').trim();
    // find the source page from audit note (already in flagged csv per id)
    const csvLine = fs.readFileSync(CSV, 'utf8').split('\n').find((l) => l.startsWith(`"${r.id}"`) || l.match(new RegExp(`^\\s*"?${r.id}"?`)));
    const note = csvLine?.match(/中文真实存在于fandom\(页:([^)]*)\)/)?.[1] || '';
    const srcPages = note.split('/').map((s) => s.trim()).filter(Boolean);

    const nameIsTrack = trackCn.has(zh) || trackEn.has(zh.toLowerCase());
    const srcIsTrackPage = srcPages.some((p) => TRACK_PAGE_RE.test(p) || COLLAB_RE.test(p) || trackEn.has(p.toLowerCase()) || trackEn.has(p.replace(/\(.*\)/, '').trim().toLowerCase()));
    const srcIsTrackByTitle = srcPages.some((p) => {
      const base = p.replace(/\(.*\)/, '').trim().toLowerCase();
      return trackEn.has(base);
    });

    const isBug = nameIsTrack || srcIsTrackPage || srcIsTrackByTitle;
    const rec = { id: r.id, game: r.game_id === 1 ? 'genshin' : 'hsr', en, name: zh, src: note, reason: [] as string[] };
    if (nameIsTrack) rec.reason.push('name==track.title_cn');
    if (srcIsTrackPage) rec.reason.push('src-page is track/short/collab');
    if (srcIsTrackByTitle) rec.reason.push('src-page title==track.title_en');
    (isBug ? bug : ok).push(rec);
  }
  await client.end();

  console.log(`\nLIKELY_BUG  (track/short/collab title misplaced as location): ${bug.length}`);
  console.log(`LIKELY_OK   (entity's real zh; en_name just ugly raw during): ${ok.length}`);
  console.log('\n=== LIKELY_BUG (all) ===');
  for (const b of bug) console.log(`  #${b.id} [${b.game}] "${b.en}" -> "${b.name}"  [${b.reason.join(';')}]  src=${b.src}`);

  const bugCsv = ['id,game,en_name,name,reason,src_pages']
    .concat(bug.map((b) => [b.id, b.game, `"${b.en}"`, `"${b.name}"`, `"${b.reason.join(';')}"`, `"${b.src}"`].join(',')))
    .join('\n');
  fs.writeFileSync(path.join(__dirname, 'out', 'translation_audit_TRUEBUGS.csv'), bugCsv);
  console.log(`\n[done] wrote out/translation_audit_TRUEBUGS.csv (${bug.length} rows)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
