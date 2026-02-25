import { Router, Request, Response } from 'express';
import { getTracks, getTrackById, streamTrack, downloadTrack } from '../controllers/trackController';

const router = Router();

// ── 全局下载开关（与 trackRoutes 保持一致）────────────────────────
const DOWNLOAD_ENABLED = false;
const downloadDisabled = (_req: Request, res: Response) =>
  res.status(503).json({ success: false, error: { code: 'DOWNLOAD_DISABLED', message: '下载功能暂时关闭，服务器维护中。' } });
// ──────────────────────────────────────────────────────────────────

// Public routes - 无需认证
router.get('/tracks', getTracks);
router.get('/tracks/:id', getTrackById);
router.get('/tracks/:id/stream', streamTrack);
router.get('/tracks/:id/download', DOWNLOAD_ENABLED ? downloadTrack : downloadDisabled);

export default router;

