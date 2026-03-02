import { Router, Request, Response } from 'express';
import https from 'https';
import http from 'http';
import { getTracks, getTrackById, streamTrack, downloadTrack } from '../controllers/trackController';
import storageService from '../services/storageService';

const router = Router();

// ── 全局下载开关（与 trackRoutes 保持一致）────────────────────────
const DOWNLOAD_ENABLED = false;
const downloadDisabled = (_req: Request, res: Response) =>
  res.status(503).json({ success: false, error: { code: 'DOWNLOAD_DISABLED', message: '下载功能暂时关闭，服务器维护中。' } });
// ──────────────────────────────────────────────────────────────────

// ── 封面图片代理（OSS 模式下中转，避免前端直连 OSS）─────────────────
// GET /api/public/covers/proxy?path=<cover_path_or_url>
router.get('/covers/proxy', async (req: Request, res: Response) => {
  try {
    const coverPath = req.query.path as string;

    if (!coverPath) {
      return res.status(400).json({ success: false, error: { code: 'MISSING_PARAM', message: 'Missing path parameter' } });
    }

    if (storageService.isOSS()) {
      // OSS 模式：通过签名 URL 中转封面图片
      const ossService = (await import('../services/ossService')).default;
      const signedUrl = await ossService.getSignedUrl(coverPath, 3600); // 1 小时有效

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

    // 本地 / WebDAV 模式：cover_path 不会是 OSS URL，走默认静态文件逻辑，直接重定向即可
    if (coverPath.startsWith('http://') || coverPath.startsWith('https://')) {
      return res.redirect(coverPath);
    }
    // 本地路径：重定向到 /uploads/...
    const normalized = coverPath.startsWith('/') ? coverPath : `/uploads/${coverPath}`;
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

