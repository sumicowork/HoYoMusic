import { Router, Request, Response } from 'express';
import https from 'https';
import http from 'http';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { getTracks, getTrackById, streamTrack, downloadTrack } from '../controllers/trackController';
import storageService from '../services/storageService';

const router = Router();

// ── 全局下载开关（与 trackRoutes 保持一致）────────────────────────
const DOWNLOAD_ENABLED = false;
const downloadDisabled = (_req: Request, res: Response) =>
  res.status(503).json({ success: false, error: { code: 'DOWNLOAD_DISABLED', message: '下载功能暂时关闭，服务器维护中。' } });
// ──────────────────────────────────────────────────────────────────

// ── 封面图片代理（OSS 模式下中转，避免前端直连 OSS）─────────────────
// GET /api/public/covers/proxy?path=<cover_path_or_url>&size=thumb
// size=thumb → 缩略图（200x200 webp），否则原图
router.get('/covers/proxy', async (req: Request, res: Response) => {
  try {
    const coverPath = req.query.path as string;
    const size = req.query.size as string;
    const isThumb = size === 'thumb';

    if (!coverPath) {
      return res.status(400).json({ success: false, error: { code: 'MISSING_PARAM', message: 'Missing path parameter' } });
    }

    // Helper: pipe image buffer through sharp for thumbnail
    const sendThumbnail = async (imageBuffer: Buffer) => {
      try {
        const thumbBuffer = await sharp(imageBuffer)
          .resize(200, 200, { fit: 'cover' })
          .webp({ quality: 75 })
          .toBuffer();
        res.setHeader('Content-Type', 'image/webp');
        res.setHeader('Content-Length', thumbBuffer.length);
        res.setHeader('Cache-Control', 'public, max-age=604800'); // 7 days
        return res.send(thumbBuffer);
      } catch (e) {
        // sharp fails → send original
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.send(imageBuffer);
      }
    };

    if (storageService.isOSS()) {
      // OSS 模式：通过签名 URL 中转封面图片
      const ossService = (await import('../services/ossService')).default;
      const signedUrl = await ossService.getSignedUrl(coverPath, 3600); // 1 小时有效

      if (isThumb) {
        // Fetch full image, then resize
        const proto = signedUrl.startsWith('https') ? https : http;
        const chunks: Buffer[] = [];
        proto.get(signedUrl, (ossRes) => {
          if (ossRes.statusCode === 404) {
            return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Cover not found' } });
          }
          ossRes.on('data', (chunk: Buffer) => chunks.push(chunk));
          ossRes.on('end', async () => {
            const imageBuffer = Buffer.concat(chunks);
            await sendThumbnail(imageBuffer);
          });
          ossRes.on('error', (err) => {
            console.error('[CoverProxy] OSS thumb error:', err);
            if (!res.headersSent) res.status(500).json({ success: false, error: { code: 'PROXY_ERROR', message: 'Proxy error' } });
          });
        }).on('error', (err) => {
          console.error('[CoverProxy] OSS request error:', err);
          if (!res.headersSent) res.status(500).json({ success: false, error: { code: 'PROXY_ERROR', message: 'Proxy error' } });
        });
        return;
      }

      const ossRequest = (signedUrl.startsWith('https') ? https : http).get(signedUrl, (ossRes) => {
        if (ossRes.statusCode === 404) {
          return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Cover not found' } });
        }

        const forwardHeaders: Record<string, string> = {
          'Content-Type': (ossRes.headers['content-type'] as string) || 'image/jpeg',
          'Cache-Control': 'public, max-age=86400', // 浏览器缓存 1 天
        };
        if (ossRes.headers['content-length']) {
          forwardHeaders['Content-Length'] = ossRes.headers['content-length'] as string;
        }
        res.writeHead(ossRes.statusCode || 200, forwardHeaders);
        ossRes.pipe(res);
      });

      ossRequest.on('error', (err) => {
        console.error('[CoverProxy] OSS proxy error:', err);
        if (!res.headersSent) {
          res.status(500).json({ success: false, error: { code: 'PROXY_ERROR', message: 'Failed to proxy cover from OSS' } });
        }
      });
      return;
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
            await sendThumbnail(imageBuffer);
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
        await sendThumbnail(imageBuffer);
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

// Public routes - 无需认证
router.get('/tracks', getTracks);
router.get('/tracks/:id', getTrackById);
router.get('/tracks/:id/stream', streamTrack);
router.get('/tracks/:id/download', DOWNLOAD_ENABLED ? downloadTrack : downloadDisabled);

export default router;

