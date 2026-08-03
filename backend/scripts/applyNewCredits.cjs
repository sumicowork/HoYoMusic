/**
 * applyNewCredits.cjs — 将 D:/补充 目录下的 LRC 抽取结果应用到生产库
 * 
 * 流程: 读取 new_credits.json → 匹配 track → 查 artist_id → 写入 track_credits
 * 用法: node applyNewCredits.cjs [--dry-run]
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// ── Config ──
const CREDITS_FILE = '/tmp/new_credits.json';
const DB = {
  host: '127.0.0.1',
  port: 5432,
  user: 'sumicowork',
  password: process.env.DB_PASSWORD || '',
  database: 'hoyomusic',
};
const DRY_RUN = process.argv.includes('--dry-run') || !process.argv.includes('--apply');

// ── Helpers ──
function normalizeAlbum(s) {
  // Windows path → just the folder name
  s = s.replace(/.*[\\\/]/, '').trim();
  return s
    .replace(/Vol_(\s*)(\d)/g, 'Vol. $2')  // Vol_ 6 → Vol. 6
    .replace(/_/g, '.')  // chaos_exe → chaos.exe
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTitle(s) {
  return s
    .replace(/^\d+\s+/, '') // 去掉编号前缀 "01 "
    .replace(/\.lrc$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripParen(s) {
  return s.replace(/[（(][^（）()]*[）)]\s*$/g, '').trim();
}

async function main() {
  const credits = JSON.parse(fs.readFileSync(CREDITS_FILE, 'utf-8'));
  console.log(`Loaded ${credits.length} LRC files`);

  const client = new Client(DB);
  await client.connect();
  console.log('Connected to production DB');

  // ── 1. 匹配 LRC → track ──
  const matches = [];
  const unmatched = [];

  for (const entry of credits) {
    if (!entry.parse?.credits?.length) continue;
    
    const parts = entry.file.split(/[\\\/]/);
    const folder = parts[0];  // First segment is the album folder
    const filename = parts[parts.length - 1].replace(/\.lrc$/i, '');
    const normAlbum = normalizeAlbum(folder);
    const normTitle = normalizeTitle(filename);

    // 先匹配 album
    const albumRes = await client.query(
      `SELECT id, title FROM albums WHERE title ILIKE $1 OR title_cn ILIKE $1 OR title_en ILIKE $1`,
      [normAlbum]
    );
    
    if (albumRes.rows.length === 0) {
      // Fuzzy: try without game prefix
      const shortAlbum = normAlbum.replace(/^[^-]+-/, '').trim();
      const afRes = await client.query(
        `SELECT id, title FROM albums WHERE title ILIKE $1 OR title_cn ILIKE $1`,
        [`%${shortAlbum}%`]
      );
      if (afRes.rows.length > 0) albumRes.rows.push(...afRes.rows);
    }

    if (albumRes.rows.length === 0) {
      unmatched.push({ folder, filename, reason: 'album not found' });
      continue;
    }

    // 取第一个匹配的 album
    const albumId = albumRes.rows[0].id;

    // 匹配 track title
    const trackRes = await client.query(
      `SELECT id, title FROM tracks WHERE album_id = $1 AND (title ILIKE $2 OR title_cn ILIKE $2)`,
      [albumId, normTitle]
    );

    if (trackRes.rows.length === 0) {
      // Fuzzy: remove parenthetical suffixes
      const shortTitle = normTitle.replace(/[（(][^)）]*[)）]/g, '').trim();
      const trRes = await client.query(
        `SELECT id, title FROM tracks WHERE album_id = $1 AND (title ILIKE $2 OR title_cn ILIKE $2)`,
        [albumId, `%${shortTitle}%`]
      );
      if (trRes.rows.length > 0) trackRes.rows.push(...trRes.rows);
    }

    if (trackRes.rows.length === 0) {
      unmatched.push({ folder, filename, normTitle, albumId, reason: 'track title not found' });
      continue;
    }

    const trackId = trackRes.rows[0].id;
    matches.push({ trackId, title: trackRes.rows[0].title, credits: entry.parse.credits, folder, filename });
  }

  console.log(`Matched: ${matches.length}, Unmatched: ${unmatched.length}`);
  if (unmatched.length > 0) {
    console.log('Unmatched:');
    unmatched.slice(0, 10).forEach(u => console.log(`  ${u.folder}/${u.filename} → ${u.reason}`));
  }

  // ── 2. 去重 + artist_id 查找 ──
  let totalInserted = 0;
  let withArtist = 0;

  for (const match of matches) {
    const { trackId, credits } = match;
    
    // 去重 (track_id, credit_key, credit_value)
    const seen = new Set();
    const unique = [];
    for (const c of credits) {
      const key = `${c.roleRaw}\t${c.name}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(c);
      }
    }

    // 幂等: DELETE + INSERT
    if (!DRY_RUN) {
      await client.query('DELETE FROM track_credits WHERE track_id = $1', [trackId]);
    }

    for (let i = 0; i < unique.length; i++) {
      const c = unique[i];
      
      // artist_id 查找或创建
      let artistId = null;
      // 精确匹配
      let nameRes = await client.query(`SELECT id FROM artists WHERE name = $1`, [c.name]);
      if (nameRes.rows.length > 0) {
        artistId = nameRes.rows[0].id;
      } else {
        // 模糊匹配：去空格、去括号后缀
        const normalized = c.name.replace(/\s*\(HOYO-MiX\)/gi, '').replace(/\s+/g, '').trim();
        nameRes = await client.query(`SELECT id FROM artists WHERE regexp_replace(name, '\\s+', '', 'g') ILIKE $1`, [normalized]);
        if (nameRes.rows.length > 0) {
          artistId = nameRes.rows[0].id;
        } else {
          // 不存在 → INSERT artists
          if (!DRY_RUN) {
            const ins = await client.query(
              `INSERT INTO artists (name) VALUES ($1) RETURNING id`,
              [c.name]
            );
            artistId = ins.rows[0].id;
          }
          withArtist++;
        }
      }

      if (!DRY_RUN) {
        await client.query(
          `INSERT INTO track_credits (track_id, credit_key, credit_value, display_order, artist_id)
           VALUES ($1, $2, $3, $4, $5)`,
          [trackId, c.roleRaw, c.name, i, artistId]
        );
      }
      totalInserted++;
    }
  }

  console.log(`\n${DRY_RUN ? '[DRY-RUN] Would insert' : 'Inserted'} ${totalInserted} credits across ${matches.length} tracks`);
  console.log(`Artist linked: ${withArtist}/${totalInserted}`);
  
  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
