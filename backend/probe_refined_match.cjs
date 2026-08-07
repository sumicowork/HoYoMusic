const fs = require('fs');
const { Client } = require('pg');
const p = 'C:/Users/sumi/AppData/Local/Temp/hoyomusic_lrc_read/after_fix_v13.json';
const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
const data = Array.isArray(raw) ? raw : (raw.files || []);
const c = new Client({ host: 'localhost', port: 5432, user: 'postgres', password: '2738744rcx', database: 'hoyomusic_import' });

const norm = s => (s || '').toLowerCase().replace(/[「」『』（）().,、_\u3000]/g, ' ').replace(/\s+/g, ' ').trim();
const stripNum = s => s.replace(/^\d+[\s.、_~\-]*/, '');
const SUF = [/ \(伴奏\)/, / \(日语\)/, / \(韩语\)/, / \(1st Take Ver_\)/, / \(望舒昼间\)/, / \(望舒夜间\)/, / \(轻策昼间\)/, / \(Wangshu Daytime\)/, / \(Qingce Daytime\)/, / \(Wangshu Night\)/, / \(Feat[_.]耀嘉音\)/, /（Feat[_.]耀嘉音）/];
function variants(fn) {
  const out = [fn];
  const n = stripNum(fn); if (n !== fn) out.push(n);
  for (const re of SUF) {
    if (re.test(fn)) {
      const cut = fn.replace(re, '').trim();
      out.push(cut);
      const cn = stripNum(cut); if (cn !== cut) out.push(cn);
    }
  }
  const loose = fn.replace(/[（(][^）)]*[）)]/g, '').trim();
  if (loose !== fn) out.push(loose);
  return [...new Set(out)];
}
(async () => {
  await c.connect();
  const tracks = await c.query('select id,title,title_cn,title_en,album_id from tracks');
  const idx = [];
  for (const tr of tracks.rows) {
    for (const f of [tr.title, tr.title_cn, tr.title_en]) {
      if (f) idx.push({ id: tr.id, norm: norm(f) });
    }
  }
  const has = cn => idx.find(x => x.norm === cn);
  let globalUnmatched = 0, refinedMatched = 0; const still = [];
  for (const f of data) {
    const full = f.file || '';
    const parts = full.split(/[\\/]/);
    const base = parts[parts.length - 1].replace(/\.lrc$/, '');
    const albumFolder = parts.length >= 2 ? parts[parts.length - 2] : '';
    if (has(norm(base))) continue;
    globalUnmatched++;
    const cands = variants(base).map(v => norm(v));
    if (cands.some(cn => has(cn))) refinedMatched++;
    else still.push({ file: full, base, albumFolder });
  }
  console.log('TOTAL_FILES:', data.length);
  console.log('GLOBAL_UNMATCHED(exact):', globalUnmatched);
  console.log('REFINED_MATCHED(improved):', refinedMatched);
  console.log('STILL_UNMATCHED(true):', still.length);
  const byGame = {};
  for (const u of still) {
    const g = (u.albumFolder.match(/^(GI|HSR|LRC\\|ToT|ZZZ)/) || ['?'])[0].replace('\\', '');
    byGame[g] = (byGame[g] || 0) + 1;
  }
  console.log('STILL_BY_PREFIX:', JSON.stringify(byGame));
  console.log('--- STILL UNMATCHED (true misses) ---');
  for (const u of still) console.log(u.file);
  fs.writeFileSync('C:/Users/sumi/AppData/Local/Temp/hoyomusic_lrc_read/still_unmatched_refined.txt', still.map(u => u.file).join('\n'));
  await c.end();
})().catch(e => { console.error(e); process.exit(1); });
