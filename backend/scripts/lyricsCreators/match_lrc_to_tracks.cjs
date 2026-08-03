// LRC 文件 -> track 匹配器（只读，不写库）
// 策略：① 整首标题归一精确匹配（吞曲号/括号/「」/：/变体后缀 日语→日文 等）为主；
//       ② 无精确命中时，取"最长公共归一前缀"的 track 兜底（天然区分 (伴奏)/(男调) 等变体）；
//       ③ 非精确命中的一律标 review 供人工核对。
const fs = require('fs');
const { Client } = require('pg');
const SRC = 'C:/Users/sumi/AppData/Local/Temp/hoyomusic_lrc_read/after_fix_v13.json';
const OUT = 'C:/Users/sumi/WebstormProjects/HoYoMusic/backend/scripts/lyricsCreators/lrc_track_match.json';
const raw = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const data = Array.isArray(raw) ? raw : (raw.files || []);
const c = new Client({ host: 'localhost', port: 5432, user: 'postgres', password: '2738744rcx', database: 'hoyomusic_import' });

function normFull(s) {
  s = (s || '').toLowerCase();
  s = s.replace(/^[\d\s._~\-\u3000%丨°]+/, '');
  s = s.replace(/日语/g, '日文').replace(/韩语/g, '韩文');
  s = s.replace(/[「」『』【】（）():：_]/g, ' ');
  s = s.replace(/[，。、！？…·•・,.'`]/g, ' ');
  return s.replace(/\s+/g, ' ').trim();
}
function lcp(a, b) { let i = 0; const n = Math.min(a.length, b.length); while (i < n && a[i] === b[i]) i++; return i; }
function gameOf(parts) {
  const s = parts.join('\n');
  if (/ZZZ/.test(s)) return '绝区零';
  if (/HSR/.test(s)) return '崩坏：星穹铁道';
  if (/ToT/.test(s)) return '未定事件簿';
  if (/GI/.test(s)) return '原神';
  return null;
}
function normBag(s) { return normFull(s).split(/\s+/).filter(Boolean).sort().join(' '); }
function matchOne(filename, pool, gameName) {
  const fn = normFull(filename);
  if (!fn || fn === gameName) return null;
  // Layer1: 整首精确
  let exact = null, exactN = 0;
  for (const t of pool) for (const f of [t.title, t.title_cn, t.title_en]) {
    if (f && normFull(f) === fn) { if (!exact) exact = t; exactN++; }
  }
  if (exact) return { t: exact, score: 1.0, type: 'full-exact', ambiguous: exactN > 1 };
  // Layer2: 去括号按词排序（处理中英括号顺序互换的同一首）
  const bag = normBag(filename);
  let bagHit = null, bagN = 0;
  for (const t of pool) for (const f of [t.title, t.title_cn, t.title_en]) {
    if (f && normBag(f) === bag) { if (!bagHit) bagHit = t; bagN++; }
  }
  if (bagHit) return { t: bagHit, score: 0.95, type: 'bag', ambiguous: bagN > 1 };
  // Layer3: 最长公共前缀兜底
  let best = null, bestLen = 0, bestTN = '', cnt = 0;
  for (const t of pool) for (const f of [t.title, t.title_cn, t.title_en]) {
    if (!f) continue; const tn = normFull(f); const L = lcp(fn, tn);
    if (L > bestLen) { bestLen = L; best = t; bestTN = tn; cnt = 1; }
    else if (L === bestLen && L > 0) cnt++;
  }
  const minLen = Math.min(fn.length, bestTN.length);
  const startsCJK = /[一-鿿]/.test(fn[0] || '');
  const ok = (bestLen >= 2 || (bestLen >= 1 && startsCJK)) && bestLen >= 0.4 * minLen;
  if (best && ok) return { t: best, score: 0.7, type: 'prefix', ambiguous: cnt > 1 };
  return null;
}
(async () => {
  await c.connect();
  const games = await c.query('select id,name from games');
  const tracks = await c.query('select t.id,t.title,t.title_cn,t.title_en,t.album_id,a.game_id from tracks t join albums a on t.album_id=a.id');
  const byGame = {};
  for (const t of tracks.rows) (byGame[t.game_id] = byGame[t.game_id] || []).push(t);
  const resolveGameId = name => { for (const g of games.rows) if (g.name === name || g.name.includes(name) || name.includes(g.name)) return g.id; return null; };

  const result = [], unmatched = [], review = [];
  let matched = 0; const byType = {};
  for (const f of data) {
    const full = f.file || '';
    const parts = full.split(/[\\/]/);
    const base = parts[parts.length - 1].replace(/\.lrc$/, '');
    const firstSeg = parts[0] || '';
    const game = gameOf(parts);
    const gid = game ? resolveGameId(game) : null;
    const pool = gid ? (byGame[gid] || []) : tracks.rows;
    let m = matchOne(base, pool, game);
    if (!m && gid) m = matchOne(base, tracks.rows, game);
    if (m) {
      matched++; byType[m.type] = (byType[m.type] || 0) + 1;
      const rec = { file: full, trackId: m.t.id, albumId: m.t.album_id, gameId: gid, matchType: m.type, ambiguous: !!m.ambiguous, trackTitle: m.t.title };
      if (m.type !== 'full-exact') { rec.review = true; review.push(rec); }
      result.push(rec);
    } else unmatched.push({ file: full, base, game });
  }
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
  fs.writeFileSync(OUT.replace('.json', '_unmatched.txt'), unmatched.map(u => u.file).join('\n'));
  fs.writeFileSync(OUT.replace('.json', '_review.txt'), review.map(r => r.file + '  ->  track#' + r.trackId + ' [' + r.trackTitle + '] (' + r.matchType + (r.ambiguous ? ',AMBIG' : '') + ')').join('\n'));
  console.log('TOTAL:', data.length, 'MATCHED:', matched, 'UNMATCHED:', unmatched.length, 'REVIEW(non-exact):', review.length);
  console.log('BY_TYPE:', JSON.stringify(byType));
  if (unmatched.length) { console.log('--- UNMATCHED ---'); for (const u of unmatched) console.log(u.file, '| game=', u.game); }
  if (review.length) { console.log('--- REVIEW (non-exact, need human check) ---'); for (const r of review) console.log(r.file, '->', '#' + r.trackId, r.trackTitle, r.matchType); }
  await c.end();
})().catch(e => { console.error(e); process.exit(1); });
