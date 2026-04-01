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
import { cacheControl, CACHE_TTL } from '../middleware/cacheHeaders';

const router = Router();

interface RecordPlayBody {
  played_seconds?: number;
  track_duration_seconds?: number;
  session_key?: string;
}

// ── 全局下载开关（通过环境变量 DOWNLOAD_ENABLED 控制）────────────
const DOWNLOAD_ENABLED = process.env.DOWNLOAD_ENABLED === 'true';
const downloadDisabled = (_req: Request, res: Response) =>
  res.status(503).json({ success: false, error: { code: 'DOWNLOAD_DISABLED', message: '下载功能暂时关闭，服务器维护中。' } });

const fetchUrlBuffer = async (url: string): Promise<{ statusCode: number; buffer: Buffer; contentType: string }> => {
  return await new Promise((resolve, reject) => {
    const MAX_BYTES = 10 * 1024 * 1024;
    const REQUEST_TIMEOUT_MS = 10000;
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, (resp) => {
      const chunks: Buffer[] = [];
      let totalSize = 0;
      resp.on('data', (chunk: Buffer) => {
        totalSize += chunk.length;
        if (totalSize > MAX_BYTES) {
          req.destroy(new Error('Remote resource too large'));
          return;
        }
        chunks.push(chunk);
      });
      resp.on('end', () => {
        resolve({
          statusCode: resp.statusCode || 200,
          buffer: Buffer.concat(chunks),
          contentType: (resp.headers['content-type'] as string) || 'image/jpeg',
        });
      });
      resp.on('error', reject);
    });

    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error('Remote request timed out'));
    });

    req.on('error', reject);
  });
};

const getRealIp = (req: Request): string => {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string') return fwd.split(',')[0].trim();
  return (req.socket?.remoteAddress || '0.0.0.0').replace(/^::ffff:/, '');
};

const toPositiveNumber = (value: unknown): number | null => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
};

const isPrivateIpv4 = (host: string): boolean => {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if ([a, b].some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
};

const isBlockedHost = (host: string): boolean => {
  const normalized = host.trim().toLowerCase();
  if (!normalized) return true;
  if (normalized === 'localhost' || normalized === '::1' || normalized.endsWith('.localhost')) return true;
  return isPrivateIpv4(normalized);
};

const parseAndValidateRemoteCoverUrl = (input: string): URL | null => {
  try {
    const parsed = new URL(input);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (isBlockedHost(parsed.hostname)) return null;
    return parsed;
  } catch {
    return null;
  }
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

        let contentType: string;
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
      const remoteUrl = parseAndValidateRemoteCoverUrl(coverPath);
      if (!remoteUrl) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_REMOTE_URL', message: 'Invalid remote cover URL' } });
      }

      const remote = await fetchUrlBuffer(remoteUrl.toString());
      if (remote.statusCode >= 400) {
        return res.status(remote.statusCode).json({
          success: false,
          error: { code: 'REMOTE_FETCH_FAILED', message: 'Failed to fetch remote cover' },
        });
      }

      if (isThumb) {
        const thumb = await buildThumbnail(remote.buffer);
        return sendImage(thumb.buffer, thumb.contentType, 604800);
      }

      return sendImage(remote.buffer, remote.contentType, 86400);
    }

    // 本地路径
    const normalized = coverPath.startsWith('/') ? coverPath : `/uploads/${coverPath}`;
    const localRelativePath = normalized.startsWith('/uploads/') ? normalized.slice('/uploads/'.length) : normalized.slice(1);
    if (localRelativePath.split('/').some((segment) => segment === '..')) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_PATH', message: 'Invalid cover path' } });
    }
    if (isThumb) {
      const UPLOAD_DIR = path.join(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
      const fullPath = path.join(UPLOAD_DIR, localRelativePath);
      try {
        await fs.promises.access(fullPath, fs.constants.F_OK);
        const imageBuffer = await fs.promises.readFile(fullPath);
        const thumb = await buildThumbnail(imageBuffer);
        sendImage(thumb.buffer, thumb.contentType, 604800);
        return;
      } catch {
        // Fallback to redirect when local file is missing.
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
router.get('/albums/random', cacheControl(CACHE_TTL.SHORT, { staleWhileRevalidate: 120 }), async (req: Request, res: Response) => {
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
router.get('/tracks/random', cacheControl(CACHE_TTL.SHORT, { staleWhileRevalidate: 120 }), async (req: Request, res: Response) => {
  try {
    const count = Math.min(parseInt(req.query.count as string) || 10, 30);
    const result = await pool.query(`
      SELECT t.*, a.title AS album_title, a.cover_path AS album_cover,
             COUNT(DISTINCT fav.user_id)::int AS favorite_count,
             COALESCE(
               json_agg(json_build_object('id', ar.id, 'name', ar.name))
               FILTER (WHERE ar.id IS NOT NULL), '[]'
             ) AS artists
      FROM tracks t
      LEFT JOIN albums a ON t.album_id = a.id
      LEFT JOIN track_artists ta ON t.id = ta.track_id
      LEFT JOIN artists ar ON ta.artist_id = ar.id
      LEFT JOIN favorites fav ON t.id = fav.track_id
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
router.get('/tracks', cacheControl(CACHE_TTL.MEDIUM, { staleWhileRevalidate: 300 }), getTracks);
router.get('/tracks/:id', cacheControl(CACHE_TTL.SHORT, { staleWhileRevalidate: 120 }), getTrackById);
router.get('/tracks/:id/stream', cacheControl(604800, { immutable: true }), streamTrack);
router.get('/tracks/:id/download', cacheControl(604800, { immutable: true }), DOWNLOAD_ENABLED ? downloadTrack : downloadDisabled);

// Record play event and mark effective plays using threshold:
// played >= max(10, min(30, duration * 0.5))
router.post('/tracks/:id/play', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const trackId = Number(id);
    if (!Number.isInteger(trackId) || trackId <= 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_TRACK_ID', message: 'Invalid track id' }
      });
    }

    const body = (req.body || {}) as RecordPlayBody;
    const playedSeconds = toPositiveNumber(body.played_seconds) ?? 0;

    const trackResult = await pool.query<{ duration: number | null }>(
      'SELECT duration FROM tracks WHERE id = $1 LIMIT 1',
      [trackId]
    );
    if (trackResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Track not found' }
      });
    }

    const durationFromBody = toPositiveNumber(body.track_duration_seconds);
    const durationFromDb = toPositiveNumber(trackResult.rows[0].duration);
    const durationSeconds = durationFromBody ?? durationFromDb;
    const minRequiredSeconds = Math.max(10, Math.min(30, (durationSeconds ?? 60) * 0.5));
    const effectivePlay = playedSeconds >= minRequiredSeconds;

    const sessionKeyRaw = String(body.session_key || '').trim();
    const sessionKey = sessionKeyRaw.length > 0
      ? sessionKeyRaw.slice(0, 128)
      : `legacy-${trackId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    const sourceIp = getRealIp(req).slice(0, 64);
    const userAgent = String(req.headers['user-agent'] || '').slice(0, 512);

    const upsertResult = await pool.query<{ effective_play: boolean }>(
      `INSERT INTO track_play_events (
         track_id,
         played_seconds,
         track_duration_seconds,
         min_required_seconds,
         effective_play,
         source_ip,
         user_agent,
         session_key,
         played_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (track_id, session_key)
       DO UPDATE SET
         played_seconds = GREATEST(track_play_events.played_seconds, EXCLUDED.played_seconds),
         track_duration_seconds = COALESCE(EXCLUDED.track_duration_seconds, track_play_events.track_duration_seconds),
         min_required_seconds = EXCLUDED.min_required_seconds,
         effective_play = (track_play_events.effective_play OR EXCLUDED.effective_play),
         source_ip = COALESCE(NULLIF(EXCLUDED.source_ip, ''), track_play_events.source_ip),
         user_agent = COALESCE(NULLIF(EXCLUDED.user_agent, ''), track_play_events.user_agent),
         played_at = NOW()
       RETURNING effective_play`,
      [
        trackId,
        playedSeconds,
        durationSeconds,
        minRequiredSeconds,
        effectivePlay,
        sourceIp,
        userAgent,
        sessionKey,
      ]
    );

    const isEffective = Boolean(upsertResult.rows[0]?.effective_play);
    return res.json({
      success: true,
      data: {
        track_id: trackId,
        effective_play: isEffective,
        played_seconds: playedSeconds,
        min_required_seconds: minRequiredSeconds,
      }
    });
  } catch {
    return res.status(500).json({ success: false });
  }
});

// Top played tracks
router.get('/top-tracks', cacheControl(CACHE_TTL.SHORT, { staleWhileRevalidate: 120 }), async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const result = await pool.query(`
      SELECT
             t.id,
             t.title,
             t.duration,
             t.play_count,
             t.cover_path,
             COUNT(DISTINCT fav.user_id)::int AS favorite_count,
             COALESCE(tp.effective_play_count, 0)::int AS effective_play_count,
             COALESCE(tp.unique_ips, 0)::int AS unique_ips,
             a.title AS album_title, a.cover_path AS album_cover,
             array_agg(json_build_object('id', ar.id, 'name', ar.name)) FILTER (WHERE ar.id IS NOT NULL) AS artists
      FROM tracks t
      LEFT JOIN (
        SELECT
          track_id,
          COUNT(*) FILTER (WHERE effective_play) AS effective_play_count,
          COUNT(DISTINCT source_ip) FILTER (WHERE effective_play AND source_ip IS NOT NULL AND source_ip <> '') AS unique_ips
        FROM track_play_events
        GROUP BY track_id
      ) tp ON tp.track_id = t.id
      LEFT JOIN albums a ON t.album_id = a.id
      LEFT JOIN favorites fav ON t.id = fav.track_id
      LEFT JOIN track_artists ta ON t.id = ta.track_id
      LEFT JOIN artists ar ON ta.artist_id = ar.id
      WHERE COALESCE(tp.effective_play_count, 0) > 0
      GROUP BY t.id, a.title, a.cover_path, tp.effective_play_count, tp.unique_ips
      ORDER BY COALESCE(tp.effective_play_count, 0) DESC, t.id DESC
      LIMIT $1
    `, [limit]);
    res.json({ success: true, data: { tracks: result.rows } });
  } catch {
    res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch top tracks' } });
  }
});

export default router;

