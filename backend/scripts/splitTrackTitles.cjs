const { Client } = require('pg');
require('dotenv').config({ path: '/opt/hoyomusic/.env' });
const db = new Client({
  host: process.env.DB_HOST, port: process.env.DB_PORT,
  user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

function hasCJK(s) { return /[\u4e00-\u9fff]/.test(s); }

function splitClean(title) {
  // 匹配: 中文开头...空格...英文(含多词)
  // "自穹苍而来 From the Great Sky" → cn="自穹苍而来" en="From the Great Sky"
  const m = title.match(/^([\u4e00-\u9fff].*?)\s+([A-Za-z][\s\S]+)$/);
  if (!m) return null;
  const cn = m[1].trim();
  const en = m[2].trim();
  if (!cn || !en || !hasCJK(cn) || hasCJK(en)) return null;
  // EN 不能以括号后缀开头 (如 "(伴奏)")
  if (/^[\(\（]/.test(en)) return null;
  return { cn, en };
}

(async () => {
  await db.connect();
  const { rows } = await db.query(
    "SELECT id, title FROM tracks WHERE title_cn = title AND title_en IS NULL AND title ~ '[A-Za-z]' AND title ~ '[\u4e00-\u9fff]' ORDER BY id"
  );

  const updates = []; const skipped = [];
  for (const r of rows) {
    const s = splitClean(r.title);
    if (s) updates.push({ id: r.id, title: r.title, ...s });
    else skipped.push({ id: r.id, title: r.title });
  }

  console.log("=== Split " + updates.length + " tracks (first 15) ===");
  updates.slice(0, 15).forEach(u => console.log("#" + u.id + " '" + u.title + "' => cn='" + u.cn + "' en='" + u.en + "'"));
  if (updates.length > 15) console.log("... +" + (updates.length - 15) + " more");

  console.log("\n=== Skipped " + skipped.length + " ===");
  skipped.forEach(s => console.log("#" + s.id + " '" + s.title + "'"));

  if (updates.length > 0) {
    await db.query('BEGIN');
    for (const u of updates) {
      await db.query('UPDATE tracks SET title_cn=$1, title_en=$2 WHERE id=$3', [u.cn, u.en, u.id]);
    }
    await db.query('COMMIT');
    console.log("\nUpdated " + updates.length + " tracks");
  }

  await db.end();
})();
