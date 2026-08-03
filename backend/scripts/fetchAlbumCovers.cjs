/**
 * fetchAlbumCovers.cjs — 从 Apple Music API 拉取专辑封面，上传 OSS，写入 DB
 * 
 * 用法: node fetchAlbumCovers.cjs [--album-id=N] [--all] [--dry-run]
 *   --album-id=N  处理单张专辑
 *   --all         处理所有缺封面的专辑
 *   --dry-run     只搜索不下载
 */
const https = require('https');
const { Client } = require('pg');
require('dotenv').config({ path: '/opt/hoyomusic/.env' });

const OSS = require('ali-oss');

const DB = {
  host: process.env.DB_HOST || '127.0.0.1', port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME,
};

const ossClient = new OSS({
  region: process.env.OSS_REGION,
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  bucket: process.env.OSS_BUCKET,
  secure: true, timeout: 30000,
});

const DRY_RUN = process.argv.includes('--dry-run');

const GAME_KEYWORDS = {
  1: 'Genshin Impact',
  2: 'Honkai Star Rail',
  3: 'Zenless Zone Zero',
  4: 'Honkai Impact 3rd',
  5: 'Honkai Gakuen 2',
  8: 'Tears of Themis',
};

function appleSearch(query, country = 'us') {
  return new Promise((resolve, reject) => {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=album&country=${country}&limit=10`;
    https.get(url, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function downloadCover(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      const bufs = [];
      res.on('data', c => bufs.push(c));
      res.on('end', () => {
        if (res.statusCode === 200) resolve(Buffer.concat(bufs));
        else reject(new Error(`HTTP ${res.statusCode}`));
      });
    }).on('error', reject);
  });
}

function matchAlbum(results, albumTitle, gameKeyword) {
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const target = norm(albumTitle);
  const kw = norm(gameKeyword || '');

  // Score each result
  const scored = results.map(r => {
    const name = norm(r.collectionName);
    let score = 0;
    if (name === target) score = 100;
    else if (name.includes(target) || target.includes(name)) score = 60;
    else if (name.includes(target.slice(0, 8))) score = 30;
    if (name.includes(kw)) score += 20;
    return { ...r, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  return best && best.score >= 30 ? best : null;
}

async function main() {
  const client = new Client(DB);
  await client.connect();

  // 查缺封面的专辑
  const albumArg = process.argv.find(a => a.startsWith('--album-id='));
  let albums;
  if (albumArg) {
    const id = parseInt(albumArg.split('=')[1]);
    albums = await client.query('SELECT id, title, title_en, title_cn, game_id FROM albums WHERE id = $1', [id]);
  } else if (process.argv.includes('--all')) {
    albums = await client.query('SELECT id, title, title_en, title_cn, game_id FROM albums WHERE cover_path IS NULL ORDER BY id');
  } else {
    console.log('Usage: node fetchAlbumCovers.cjs --all | --album-id=N [--dry-run]');
    await client.end();
    return;
  }

  console.log(`Processing ${albums.rows.length} albums...\n`);

  for (const a of albums.rows) {
    const kw = GAME_KEYWORDS[a.game_id] || '';
    // 搜索词：优先 title_en，否则 title
    const searchTerm = (a.title_en || a.title).replace(/[（(].*[)）]/g, '').trim();
    const query = `${searchTerm} ${kw}`;
    console.log(`#${a.id} "${a.title}" → search "${query}"`);

    try {
      // 策略：中文名搜中国区 / 英文名搜美国区
      let result = { results: [] };
      
      if (a.title_cn && a.title_cn !== a.title) {
        // 有独立中文名 → 优先中国区
        result = await appleSearch(a.title_cn.replace(/[（(].*[)）]/g, '').trim(), 'cn');
        if (!result.results?.length) result = await appleSearch(a.title_cn.replace(/[（(].*[)）]/g, '').trim(), 'tw');
      }
      
      // 中国区没找到 → 美国区兜底
      if (!result.results?.length) {
        result = await appleSearch(query, 'us');
      }

      const match = matchAlbum(result.results || [], a.title_cn || searchTerm, kw);

      if (!match) {
        console.log(`  ❌ No match found. Top results:`);
        (result.results || []).slice(0, 3).forEach(r =>
          console.log(`     "${r.collectionName}" — ${r.artistName}`)
        );
        continue;
      }

      const artworkUrl = match.artworkUrl100.replace('100x100bb', '3000x3000bb');
      console.log(`  ✅ "${match.collectionName}" by ${match.artistName}`);
      console.log(`  📷 ${artworkUrl}`);

      if (!DRY_RUN) {
        // 下载
        const buf = await downloadCover(artworkUrl);
        console.log(`  ⬇ ${(buf.length / 1024).toFixed(0)}KB`);

        // 上传 OSS
        const ext = '.jpg';
        const objectKey = `hoyomusic/covers/album_${a.id}${ext}`;
        await ossClient.put(objectKey, buf, { mime: 'image/jpeg' });
        console.log(`  ☁ OSS: ${objectKey}`);

        // 写入 DB
        const coverPath = `https://${process.env.OSS_BUCKET}.${process.env.OSS_REGION}.aliyuncs.com/${objectKey}`;
        await client.query('UPDATE albums SET cover_path = $1 WHERE id = $2', [coverPath, a.id]);
        console.log(`  💾 DB updated`);

        // 清服务器端封面缓存（否则浏览器看到的还是旧图）
        const crypto = require('crypto');
        const cacheRoot = process.env.REMOTE_RESOURCE_CACHE_DIR || path.join(process.cwd(), 'uploads/cache/remote');
        ['thumb', 'origin'].forEach(variant => {
          const ck = `cover:${coverPath}:${variant}`;
          const hash = crypto.createHash('sha1').update(ck).digest('hex');
          const shard = hash.slice(0, 2);
          const cacheFile = path.join(cacheRoot, 'covers', shard, `${hash}.bin`);
          try { require('fs').unlinkSync(cacheFile); console.log(`  🗑 Cache cleared: ${variant}`); }
          catch {}
        });
        console.log('');
      } else {
        console.log(`  [DRY-RUN] would download + upload\n`);
      }
    } catch (e) {
      console.log(`  ⚠ Error: ${e.message}\n`);
    }
  }

  await client.end();
  console.log('Done.');
}

main().catch(e => { console.error(e); process.exit(1); });
