/**
 * export-static.ts
 *
 * 从 PostgreSQL 导出全量数据为静态 JSON 文件，
 * 同时复制封面图片到前端 public/data/covers/，
 * 供 Vite 静态构建使用。
 *
 * 用法:
 *   CDN_BASE_URL=https://cdn.example.com/tracks npx ts-node scripts/export-static.ts
 *
 * 环境变量:
 *   CDN_BASE_URL  — FLAC 音频文件的 CDN 前缀（必需）
 *   COVER_MODE    — inline（默认，复制到 public/data/covers/）| cdn（写 CDN URL）
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';

dotenv.config();

// ── 配置 ────────────────────────────────────────────────────
const CDN_BASE_URL = process.env.CDN_BASE_URL || '';
const COVER_MODE = process.env.COVER_MODE || 'inline'; // inline | cdn
const COVER_CDN_URL = process.env.COVER_CDN_URL || CDN_BASE_URL;

const FRONTEND_DATA_DIR = path.resolve(__dirname, '../../frontend/public/data');
const UPLOADS_DIR = path.resolve(__dirname, '../uploads');

if (!CDN_BASE_URL) {
  console.error('❌ 请设置 CDN_BASE_URL 环境变量，例如:');
  console.error('   CDN_BASE_URL=https://cdn.example.com/tracks npx ts-node scripts/export-static.ts');
  process.exit(1);
}

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'hoyomusic',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});

// ── 工具函数 ──────────────────────────────────────────────────
async function ensureDir(dir: string) {
  await fsp.mkdir(dir, { recursive: true });
}

async function writeJSON(filePath: string, data: any) {
  await ensureDir(path.dirname(filePath));
  await fsp.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/** 将数据库中的 file_path 转为 CDN URL */
function toAudioUrl(filePath: string): string {
  // file_path 格式: /uploads/tracks/xxx.flac
  const filename = path.basename(filePath);
  return `${CDN_BASE_URL.replace(/\/$/, '')}/${filename}`;
}

/** 将数据库中的 cover_path 转为静态路径 */
function toCoverPath(coverPath: string | null): string | null {
  if (!coverPath) return null;
  if (coverPath.startsWith('http://') || coverPath.startsWith('https://')) return coverPath;

  const filename = path.basename(coverPath);
  if (COVER_MODE === 'cdn') {
    return `${COVER_CDN_URL.replace(/\/$/, '')}/${filename}`;
  }
  // inline mode: /data/covers/filename
  return `/data/covers/${filename}`;
}

/** 复制封面文件到 public/data/covers/ */
async function copyCover(coverPath: string | null) {
  if (!coverPath || COVER_MODE === 'cdn') return;
  if (coverPath.startsWith('http://') || coverPath.startsWith('https://')) return;

  const filename = path.basename(coverPath);
  // coverPath 可能是 /uploads/covers/xxx.jpg 或 covers/xxx.jpg
  const possibleSources = [
    path.join(UPLOADS_DIR, 'covers', filename),
    path.join(UPLOADS_DIR, coverPath.replace(/^\/uploads\//, '')),
  ];

  const destDir = path.join(FRONTEND_DATA_DIR, 'covers');
  await ensureDir(destDir);

  for (const src of possibleSources) {
    if (fs.existsSync(src)) {
      await fsp.copyFile(src, path.join(destDir, filename));
      return;
    }
  }
}

// ── 导出逻辑 ──────────────────────────────────────────────────
async function exportAll() {
  console.log('🚀 开始静态数据导出...');
  console.log(`   CDN_BASE_URL = ${CDN_BASE_URL}`);
  console.log(`   COVER_MODE   = ${COVER_MODE}`);
  console.log(`   输出目录      = ${FRONTEND_DATA_DIR}`);
  console.log('');

  // 清空目标目录
  if (fs.existsSync(FRONTEND_DATA_DIR)) {
    await fsp.rm(FRONTEND_DATA_DIR, { recursive: true });
  }
  await ensureDir(FRONTEND_DATA_DIR);

  // ──────────── Games ────────────
  console.log('📦 导出 games...');
  const gamesResult = await pool.query(`
    SELECT g.*, COUNT(DISTINCT a.id)::int as album_count
    FROM games g
    LEFT JOIN albums a ON g.id = a.game_id
    GROUP BY g.id
    ORDER BY g.display_order ASC, g.name ASC
  `);
  const games = gamesResult.rows.map((g: any) => ({
    ...g,
    cover_path: toCoverPath(g.cover_path),
  }));
  await writeJSON(path.join(FRONTEND_DATA_DIR, 'games.json'), games);

  for (const game of games) {
    await copyCover(game.cover_path);

    const albumsResult = await pool.query(`
      SELECT a.*, COUNT(DISTINCT t.id)::int as track_count, COALESCE(SUM(t.duration), 0)::int as total_duration
      FROM albums a
      LEFT JOIN tracks t ON a.id = t.album_id
      WHERE a.game_id = $1
      GROUP BY a.id
      ORDER BY a.release_date DESC, a.title ASC
    `, [game.id]);

    const albums = albumsResult.rows.map((a: any) => ({
      ...a,
      cover_path: toCoverPath(a.cover_path),
    }));

    await writeJSON(path.join(FRONTEND_DATA_DIR, 'games', `${game.id}.json`), {
      game,
      albums,
    });
  }
  console.log(`   ✅ ${games.length} 个游戏`);

  // ──────────── Albums ────────────
  console.log('📦 导出 albums...');
  const allAlbumsResult = await pool.query(`
    SELECT a.*, COUNT(DISTINCT t.id)::int as track_count, COALESCE(SUM(t.duration), 0)::int as total_duration
    FROM albums a
    LEFT JOIN tracks t ON a.id = t.album_id
    GROUP BY a.id
    ORDER BY a.created_at DESC
  `);
  const allAlbums = allAlbumsResult.rows.map((a: any) => ({
    ...a,
    cover_path: toCoverPath(a.cover_path),
  }));
  await writeJSON(path.join(FRONTEND_DATA_DIR, 'albums.json'), allAlbums);

  for (const album of allAlbums) {
    await copyCover(album.cover_path);

    const tracksResult = await pool.query(`
      SELECT t.*, a.title as album_title, a.cover_path as album_cover,
        array_agg(json_build_object('id', ar.id, 'name', ar.name)) as artists
      FROM tracks t
      LEFT JOIN albums a ON t.album_id = a.id
      LEFT JOIN track_artists ta ON t.id = ta.track_id
      LEFT JOIN artists ar ON ta.artist_id = ar.id
      WHERE t.album_id = $1
      GROUP BY t.id, a.title, a.cover_path
      ORDER BY t.track_number ASC, t.title ASC
    `, [album.id]);

    const tracks = tracksResult.rows.map((t: any) => ({
      ...t,
      artists: (t.artists || []).filter((a: any) => a.id !== null),
      audio_url: toAudioUrl(t.file_path),
      cover_path: toCoverPath(t.cover_path),
      album_cover: toCoverPath(t.album_cover),
    }));

    await writeJSON(path.join(FRONTEND_DATA_DIR, 'albums', `${album.id}.json`), {
      album,
      tracks,
    });
  }
  console.log(`   ✅ ${allAlbums.length} 张专辑`);

  // ──────────── Tracks (全量列表 + 单曲详情) ────────────
  console.log('📦 导出 tracks...');

  // 获取所有 track 的 tags 映射
  const trackTagsResult = await pool.query(`
    SELECT tt.track_id, json_build_object('id', t.id, 'name', t.name, 'color', t.color) as tag
    FROM track_tags tt
    JOIN tags t ON tt.tag_id = t.id
  `);
  const trackTagsMap: Record<number, any[]> = {};
  for (const row of trackTagsResult.rows) {
    if (!trackTagsMap[row.track_id]) trackTagsMap[row.track_id] = [];
    trackTagsMap[row.track_id].push(row.tag);
  }

  const allTracksResult = await pool.query(`
    SELECT t.*, a.title as album_title, a.cover_path as album_cover,
      array_agg(json_build_object('id', ar.id, 'name', ar.name)) as artists
    FROM tracks t
    LEFT JOIN albums a ON t.album_id = a.id
    LEFT JOIN track_artists ta ON t.id = ta.track_id
    LEFT JOIN artists ar ON ta.artist_id = ar.id
    GROUP BY t.id, a.title, a.cover_path
    ORDER BY t.created_at DESC
  `);

  const allTracks = allTracksResult.rows.map((t: any) => ({
    ...t,
    artists: (t.artists || []).filter((a: any) => a.id !== null),
    audio_url: toAudioUrl(t.file_path),
    cover_path: toCoverPath(t.cover_path),
    album_cover: toCoverPath(t.album_cover),
    tags: trackTagsMap[t.id] || [],
  }));

  // 全量列表（不含 lyrics/credits，体积较小）
  await writeJSON(path.join(FRONTEND_DATA_DIR, 'tracks.json'), allTracks);

  // 单曲详情（含 lyrics + credits）
  const creditsResult = await pool.query(`
    SELECT id, track_id, credit_key, credit_value, display_order
    FROM track_credits
    ORDER BY track_id, display_order ASC, id ASC
  `);
  const creditsMap: Record<number, any[]> = {};
  for (const row of creditsResult.rows) {
    if (!creditsMap[row.track_id]) creditsMap[row.track_id] = [];
    creditsMap[row.track_id].push({
      id: row.id,
      credit_key: row.credit_key,
      credit_value: row.credit_value,
      display_order: row.display_order,
    });
  }

  for (const track of allTracks) {
    await copyCover(track.cover_path);

    // 读取歌词文件
    let lyrics: string | null = null;
    if (track.lyrics_path) {
      const lyricsFile = path.join(UPLOADS_DIR, track.lyrics_path.replace(/^\//, ''));
      if (fs.existsSync(lyricsFile)) {
        lyrics = await fsp.readFile(lyricsFile, 'utf-8');
      }
    }

    await writeJSON(path.join(FRONTEND_DATA_DIR, 'tracks', `${track.id}.json`), {
      ...track,
      lyrics,
      credits: creditsMap[track.id] || [],
    });
  }
  console.log(`   ✅ ${allTracks.length} 首曲目`);

  // ──────────── Artists ────────────
  console.log('📦 导出 artists...');
  const artistsResult = await pool.query(`
    SELECT
      tc.credit_value AS name,
      COUNT(DISTINCT tc.track_id)::int AS track_count,
      COUNT(DISTINCT t.album_id)::int AS album_count,
      array_agg(DISTINCT tc.credit_key) AS roles
    FROM track_credits tc
    LEFT JOIN tracks t ON tc.track_id = t.id
    WHERE tc.credit_value IS NOT NULL AND tc.credit_value <> ''
    GROUP BY tc.credit_value
    ORDER BY COUNT(DISTINCT tc.track_id) DESC, tc.credit_value ASC
  `);
  const allArtists = artistsResult.rows;
  await writeJSON(path.join(FRONTEND_DATA_DIR, 'artists.json'), allArtists);

  for (const artist of allArtists) {
    const name = artist.name;

    // tracks
    const aTracksResult = await pool.query(`
      SELECT t.*, a.title AS album_title, a.cover_path AS album_cover,
        array_agg(DISTINCT tc2.credit_key) AS roles,
        array_agg(json_build_object('id', ar.id, 'name', ar.name)) AS artists
      FROM track_credits tc
      JOIN tracks t ON tc.track_id = t.id
      LEFT JOIN albums a ON t.album_id = a.id
      LEFT JOIN track_credits tc2 ON tc2.track_id = t.id AND LOWER(tc2.credit_value) = LOWER($1)
      LEFT JOIN track_artists ta ON t.id = ta.track_id
      LEFT JOIN artists ar ON ta.artist_id = ar.id
      WHERE LOWER(tc.credit_value) = LOWER($1)
      GROUP BY t.id, a.title, a.cover_path
      ORDER BY t.created_at DESC
    `, [name]);

    const aTracks = aTracksResult.rows.map((t: any) => ({
      ...t,
      artists: (t.artists || []).filter((a: any) => a.id !== null),
      audio_url: toAudioUrl(t.file_path),
      cover_path: toCoverPath(t.cover_path),
      album_cover: toCoverPath(t.album_cover),
    }));

    // albums
    const aAlbumsResult = await pool.query(`
      SELECT DISTINCT a.*, COUNT(DISTINCT t2.id)::int AS track_count
      FROM track_credits tc
      JOIN tracks t ON tc.track_id = t.id
      JOIN albums a ON t.album_id = a.id
      LEFT JOIN tracks t2 ON a.id = t2.album_id
      WHERE LOWER(tc.credit_value) = LOWER($1)
      GROUP BY a.id
      ORDER BY a.release_date DESC, a.title ASC
    `, [name]);

    const aAlbums = aAlbumsResult.rows.map((a: any) => ({
      ...a,
      cover_path: toCoverPath(a.cover_path),
    }));

    // stats
    const statsResult = await pool.query(`
      SELECT
        COUNT(DISTINCT tc.track_id)::int AS track_count,
        COUNT(DISTINCT t.album_id)::int AS album_count,
        array_agg(DISTINCT tc.credit_key) AS roles
      FROM track_credits tc
      LEFT JOIN tracks t ON tc.track_id = t.id
      WHERE LOWER(tc.credit_value) = LOWER($1)
    `, [name]);
    const stats = statsResult.rows[0];

    await writeJSON(
      path.join(FRONTEND_DATA_DIR, 'artists', `${encodeURIComponent(name)}.json`),
      {
        artist: {
          id: null,
          name,
          track_count: stats.track_count,
          album_count: stats.album_count,
          roles: (stats.roles || []).filter(Boolean),
        },
        tracks: aTracks,
        albums: aAlbums,
      }
    );
  }
  console.log(`   ✅ ${allArtists.length} 位创作者`);

  // ──────────── Tags ────────────
  console.log('📦 导出 tags...');
  const tagsResult = await pool.query(`
    SELECT
      t.*,
      tg.name as group_name, tg.icon as group_icon, tg.display_order as group_order,
      pt.name as parent_name,
      COUNT(DISTINCT tt.track_id)::int as track_count,
      (SELECT COUNT(*)::int FROM tags ct WHERE ct.parent_id = t.id) as children_count
    FROM tags t
    LEFT JOIN tag_groups tg ON t.group_id = tg.id
    LEFT JOIN tags pt ON t.parent_id = pt.id
    LEFT JOIN track_tags tt ON t.id = tt.tag_id
    GROUP BY t.id, tg.name, tg.icon, tg.display_order, pt.name
    ORDER BY tg.display_order ASC NULLS LAST, t.parent_id ASC NULLS FIRST, t.display_order ASC, t.name ASC
  `);
  await writeJSON(path.join(FRONTEND_DATA_DIR, 'tags.json'), tagsResult.rows);

  // Tag groups
  const tagGroupsResult = await pool.query(`
    SELECT tg.*, COUNT(DISTINCT t.id)::int as tag_count
    FROM tag_groups tg
    LEFT JOIN tags t ON tg.id = t.group_id
    GROUP BY tg.id
    ORDER BY tg.display_order ASC
  `);
  await writeJSON(path.join(FRONTEND_DATA_DIR, 'tag-groups.json'), tagGroupsResult.rows);

  // 单标签详情
  for (const tag of tagsResult.rows) {
    // children
    const childrenResult = await pool.query(`
      SELECT t.*, COUNT(DISTINCT tt.track_id)::int as track_count
      FROM tags t LEFT JOIN track_tags tt ON t.id = tt.tag_id
      WHERE t.parent_id = $1
      GROUP BY t.id
      ORDER BY t.display_order ASC, t.name ASC
    `, [tag.id]);

    // tracks
    const tagTracksResult = await pool.query(`
      SELECT tr.*, a.title as album_title, a.cover_path as album_cover,
        array_agg(DISTINCT jsonb_build_object('id', ar.id, 'name', ar.name)) as artists
      FROM track_tags tt
      INNER JOIN tracks tr ON tt.track_id = tr.id
      LEFT JOIN albums a ON tr.album_id = a.id
      LEFT JOIN track_artists ta ON tr.id = ta.track_id
      LEFT JOIN artists ar ON ta.artist_id = ar.id
      WHERE tt.tag_id = $1
      GROUP BY tr.id, a.title, a.cover_path
      ORDER BY tr.created_at DESC
    `, [tag.id]);

    const tagTracks = tagTracksResult.rows.map((t: any) => ({
      ...t,
      artists: (t.artists || []).filter((a: any) => a.id !== null),
      audio_url: toAudioUrl(t.file_path),
      cover_path: toCoverPath(t.cover_path),
      album_cover: toCoverPath(t.album_cover),
    }));

    await writeJSON(path.join(FRONTEND_DATA_DIR, 'tags', `${tag.id}.json`), {
      ...tag,
      children: childrenResult.rows,
      tracks: tagTracks,
    });
  }
  console.log(`   ✅ ${tagsResult.rows.length} 个标签`);

  // ──────────── 完成 ────────────
  await pool.end();

  // 统计输出
  const totalFiles = await countFiles(FRONTEND_DATA_DIR);
  const totalSize = await dirSize(FRONTEND_DATA_DIR);
  console.log('');
  console.log('════════════════════════════════════════════');
  console.log('✅ 静态数据导出完成！');
  console.log(`   📊 ${games.length} 游戏 / ${allAlbums.length} 专辑 / ${allTracks.length} 曲目 / ${allArtists.length} 创作者 / ${tagsResult.rows.length} 标签`);
  console.log(`   📁 生成 ${totalFiles} 个文件，总计 ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   📂 输出目录: ${FRONTEND_DATA_DIR}`);
  console.log('');
  console.log('下一步: cd frontend && npm run build:static');
  console.log('════════════════════════════════════════════');
}

async function countFiles(dir: string): Promise<number> {
  let count = 0;
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      count += await countFiles(path.join(dir, entry.name));
    } else {
      count++;
    }
  }
  return count;
}

async function dirSize(dir: string): Promise<number> {
  let size = 0;
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      size += await dirSize(fullPath);
    } else {
      const stat = await fsp.stat(fullPath);
      size += stat.size;
    }
  }
  return size;
}

exportAll().catch((err) => {
  console.error('❌ 导出失败:', err);
  process.exit(1);
});

