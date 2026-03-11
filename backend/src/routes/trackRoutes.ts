import { Router, Request, Response } from 'express';
import { uploadTracks, getTracks, getTrackById, streamTrack, downloadTrack, updateTrack, deleteTrack, uploadTrackCover, bulkDeleteTracks, bulkMoveTracksToAlbum, previewCredits } from '../controllers/trackController';
import { authenticateJWT } from '../middleware/auth';
import { authenticateStream } from '../middleware/authenticateStream';
import upload, { coverUpload } from '../middleware/upload';
import { validateBody } from '../middleware/validate';
import { updateTrackSchema, bulkDeleteTracksSchema, bulkMoveTracksSchema } from '../validators/schemas';

const router = Router();

// ── 全局下载开关（通过环境变量 DOWNLOAD_ENABLED 控制）────────────
const DOWNLOAD_ENABLED = process.env.DOWNLOAD_ENABLED === 'true';
const downloadDisabled = (_req: Request, res: Response) =>
  res.status(503).json({ success: false, error: { code: 'DOWNLOAD_DISABLED', message: '下载功能暂时关闭，服务器维护中。' } });
// ──────────────────────────────────────────────────────────────────

// All track routes require authentication
router.post('/upload', authenticateJWT, upload.array('tracks', 20), uploadTracks);
router.post('/preview-credits', authenticateJWT, upload.array('tracks', 20), previewCredits);
router.delete('/bulk', authenticateJWT, validateBody(bulkDeleteTracksSchema), bulkDeleteTracks);
router.post('/bulk-move', authenticateJWT, validateBody(bulkMoveTracksSchema), bulkMoveTracksToAlbum);
router.get('/', authenticateJWT, getTracks);
router.get('/:id', authenticateJWT, getTrackById);
router.put('/:id', authenticateJWT, validateBody(updateTrackSchema), updateTrack);
router.delete('/:id', authenticateJWT, deleteTrack);
router.post('/:id/cover', authenticateJWT, coverUpload.single('cover'), uploadTrackCover);
router.get('/:id/stream', authenticateStream, streamTrack);
router.get('/:id/download', authenticateStream, DOWNLOAD_ENABLED ? downloadTrack : downloadDisabled);

export default router;

