import { Router, Request, Response } from 'express';
import https from 'https';
import http from 'http';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { getTracks, getTrackById, streamTrack, downloadTrack } from '../controllers/trackController';
import pool from '../config/database';
import storageService from '../services/storageService';
import remoteResourceCache from '../services/remoteResourceCache';

const router = Router();

// ── 全局下载开关（通过环境变量 DOWNLOAD_ENABLED 控制）────────────
const DOWNLOAD_ENABLED = process.env.DOWNLOAD_ENABLED === 'true';
const downloadDisabled = (_req: Request, res: Response) =>
  res.status(503).json({ success: false, error: { code: 'DOWNLOAD_DISABLED', message: '下载功能暂时关闭，服务器维护中。' } });

const fetchUrlBuffer = async (url: string): Promise<{ statusCode: number; buffer: Buffer; contentType: string }> => {
  return await new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (resp) => {
      const chunks: Buffer[] = [];
      resp.on('data', (chunk: Buffer) => chunks.push(chunk));
      resp.on('end', () => {
        resolve({
          statusCode: resp.statusCode || 200,
          buffer: Buffer.concat(chunks),
          contentType: (resp.headers['content-type'] as string) || 'image/jpeg',
        });
      });
      resp.on('error', reject);
    }).on('error', reject);
  });
};
// ──────────────────────────────────────────────────────────────────

// ── 封面图片代理（OSS 模式下中转，避免前端直连 OSS）─────────────────
// GET /api/public/covers/proxy?path=<cover_path_or_url>&size=thumb
// size=thumb → 缩略图（1000x1000 webp），否则原图
router.get('/covers/proxy', async (req: Request, res: Response) => {
  try {
    const coverPath = req.query.path as string;
    const size = req.query.size as string;
    const isThumb = size === 'thumb';

    if (!coverPath) {
      return res.status(400).json({ success: false, error: { code: 'MISSING_PARAM', message: 'Missing path parameter' } });
    }

    // Helper: convert image buffer to thumbnail (resize only, preserve format family)
    const buildThumbnail = async (imageBuffer: Buffer): Promise<{ buffer: Buffer; contentType: string }> => {
      try {
        // Detect original format
        const meta = await sharp(imageBuffer).metadata();
        const fmt = meta.format; // 'jpeg' | 'png' | 'webp' | 'flac' etc.

        let pipeline = sharp(imageBuffer)
          .resize(1000, 1000, { fit: 'cover', withoutEnlargement: true });

        let contentType = 'image/jpeg';
        if (fmt === 'png') {
          pipeline = pipeline.png();
          contentType = 'image/png';
        } else if (fmt === 'webp') {
          pipeline = pipeline.webp();
          contentType = 'image/webp';
        } else {
          // default: jpeg, no quality override → preserves encoder default
          pipeline = pipeline.jpeg();
          contentType = 'image/jpeg';
        }

        const thumbBuffer = await pipeline.toBuffer();
        return { buffer: thumbBuffer, contentType };
      } catch (e) {
        // sharp fails → use original bytes
        return { buffer: imageBuffer, contentType: 'image/jpeg' };
      }
    };

    const sendImage = (buffer: Buffer, contentType: string, maxAge: number) => {
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Cache-Control', `public, max-age=${maxAge}`);
      return res.send(buffer);
    };

    if (storageService.isOSS()) {
      const cacheKey = `cover:${coverPath}:${isThumb ? 'thumb' : 'origin'}`;
      const cached = await remoteResourceCache.getBinary('covers', cacheKey);
      if (cached) {
        return sendImage(cached.buffer, cached.contentType, isThumb ? 604800 : 86400);
      }

      // OSS 模式：通过签名 URL 中转封面图片
      const ossService = (await import('../services/ossService')).default;
      const signedUrl = await ossService.getSignedUrl(coverPath, 3600); // 1 小时有效

      if (isThumb) {
        const remote = await fetchUrlBuffer(signedUrl);
        if (remote.statusCode === 404) {
          return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Cover not found' } });
        }
        const thumb = await buildThumbnail(remote.buffer);
        await remoteResourceCache.setBinary('covers', cacheKey, thumb);
        return sendImage(thumb.buffer, thumb.contentType, 604800);
      }
      const remote = await fetchUrlBuffer(signedUrl);
      if (remote.statusCode === 404) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Cover not found' } });
      }
      await remoteResourceCache.setBinary('covers', cacheKey, { buffer: remote.buffer, contentType: remote.contentType });
      return sendImage(remote.buffer, remote.contentType, 86400);
    }

    // 本地 / WebDAV 模式
    if (coverPath.startsWith('http://') || coverPath.startsWith('https://')) {
      if (isThumb) {
        // Fetch remote image, resize
        const proto = coverPath.startsWith('https') ? https : http;
        const chunks: Buffer[] = [];
        proto.get(coverPath, (remoteRes) => {
          remoteRes.on('data', (chunk: Buffer) => chunks.push(chunk));
          remoteRes.on('end', async () => {
            const imageBuffer = Buffer.concat(chunks);
            const thumb = await buildThumbnail(imageBuffer);
            sendImage(thumb.buffer, thumb.contentType, 604800);
          });
          remoteRes.on('error', () => res.redirect(coverPath));
        }).on('error', () => res.redirect(coverPath));
        return;
      }
      return res.redirect(coverPath);
    }

    // 本地路径
    const normalized = coverPath.startsWith('/') ? coverPath : `/uploads/${coverPath}`;
    if (isThumb) {
      const UPLOAD_DIR = path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
      const stripped = normalized.startsWith('/uploads/') ? normalized.slice('/uploads/'.length) : normalized.slice(1);
      const fullPath = path.join(UPLOAD_DIR, stripped);
      if (fs.existsSync(fullPath)) {
        const imageBuffer = fs.readFileSync(fullPath);
        const thumb = await buildThumbnail(imageBuffer);
        sendImage(thumb.buffer, thumb.contentType, 604800);
        return;
      }
    }
    return res.redirect(normalized);
  } catch (error) {
    console.error('[CoverProxy] Error:', error);
    res.status(500).json({ success: false, error: { code: 'PROXY_ERROR', message: 'Failed to proxy cover' } });
  }
});
// ──────────────────────────────────────────────────────────────────

// ── Random Albums — 随机专辑推荐 ──────────────────────────────────
router.get('/albums/random', async (req: Request, res: Response) => {
  try {
    const count = Math.min(parseInt(req.query.count as string) || 6, 20);
    const result = await pool.query(`
      SELECT a.*, COUNT(DISTINCT t.id)::int AS track_count,
             COALESCE(SUM(t.duration), 0)::int AS total_duration,
             g.name AS game_name
      FROM albums a
      LEFT JOIN tracks t ON a.id = t.album_id
      LEFT JOIN games g ON a.game_id = g.id
      GROUP BY a.id, g.name
      HAVING COUNT(DISTINCT t.id) > 0
      ORDER BY RANDOM()
      LIMIT $1
    `, [count]);
    res.json({ success: true, data: { albums: result.rows } });
  } catch (error) {
    console.error('[RandomAlbums] Error:', error);
    res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch random albums' } });
  }
});

// ── Random Tracks — 随机曲目推荐 ─────────────────────────────────
router.get('/tracks/random', async (req: Request, res: Response) => {
  try {
    const count = Math.min(parseInt(req.query.count as string) || 10, 30);
    const result = await pool.query(`
      SELECT t.*, a.title AS album_title, a.cover_path AS album_cover,
             COALESCE(
               json_agg(json_build_object('id', ar.id, 'name', ar.name))
               FILTER (WHERE ar.id IS NOT NULL), '[]'
             ) AS artists
      FROM tracks t
      LEFT JOIN albums a ON t.album_id = a.id
      LEFT JOIN track_artists ta ON t.id = ta.track_id
      LEFT JOIN artists ar ON ta.artist_id = ar.id
      GROUP BY t.id, a.title, a.cover_path
      ORDER BY RANDOM()
      LIMIT $1
    `, [count]);
    res.json({ success: true, data: { tracks: result.rows } });
  } catch (error) {
    console.error('[RandomTracks] Error:', error);
    res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch random tracks' } });
  }
});

// Public routes - 无需认证
router.get('/tracks', getTracks);
router.get('/tracks/:id', getTrackById);
router.get('/tracks/:id/stream', streamTrack);
router.get('/tracks/:id/download', DOWNLOAD_ENABLED ? downloadTrack : downloadDisabled);

// Increment play count
router.post('/tracks/:id/play', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await pool.query('UPDATE tracks SET play_count = COALESCE(play_count, 0) + 1 WHERE id = $1', [id]);
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false });
  }
});

// Top played tracks
router.get('/top-tracks', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const result = await pool.query(`
      SELECT t.id, t.title, t.duration, t.play_count, t.cover_path,
             a.title AS album_title, a.cover_path AS album_cover,
             array_agg(json_build_object('id', ar.id, 'name', ar.name)) FILTER (WHERE ar.id IS NOT NULL) AS artists
      FROM tracks t
      LEFT JOIN albums a ON t.album_id = a.id
      LEFT JOIN track_artists ta ON t.id = ta.track_id
      LEFT JOIN artists ar ON ta.artist_id = ar.id
      WHERE t.play_count > 0
      GROUP BY t.id, a.title, a.cover_path
      ORDER BY t.play_count DESC NULLS LAST
      LIMIT $1
    `, [limit]);
    res.json({ success: true, data: { tracks: result.rows } });
  } catch {
    res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch top tracks' } });
  }
});

export default router;

