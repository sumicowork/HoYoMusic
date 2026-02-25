import { Router, Request, Response } from 'express';
import { uploadTracks, getTracks, getTrackById, streamTrack, downloadTrack, updateTrack, deleteTrack, uploadTrackCover, bulkDeleteTracks, bulkMoveTracksToAlbum, previewCredits } from '../controllers/trackController';
import { authenticateJWT } from '../middleware/auth';
import { authenticateStream } from '../middleware/authenticateStream';
import upload, { coverUpload } from '../middleware/upload';

const router = Router();

// ── 全局下载开关（服务器维护期间关闭）────────────────────────────
const DOWNLOAD_ENABLED = false;
const downloadDisabled = (_req: Request, res: Response) =>
  res.status(503).json({ success: false, error: { code: 'DOWNLOAD_DISABLED', message: '下载功能暂时关闭，服务器维护中。' } });
// ──────────────────────────────────────────────────────────────────

// All track routes require authentication
router.post('/upload', authenticateJWT, upload.array('tracks', 20), uploadTracks);
router.post('/preview-credits', authenticateJWT, upload.array('tracks', 20), previewCredits);
router.delete('/bulk', authenticateJWT, bulkDeleteTracks);
router.post('/bulk-move', authenticateJWT, bulkMoveTracksToAlbum);
router.get('/', authenticateJWT, getTracks);
router.get('/:id', authenticateJWT, getTrackById);
router.put('/:id', authenticateJWT, updateTrack);
router.delete('/:id', authenticateJWT, deleteTrack);
router.post('/:id/cover', authenticateJWT, coverUpload.single('cover'), uploadTrackCover);
router.get('/:id/stream', authenticateStream, streamTrack);
router.get('/:id/download', authenticateStream, DOWNLOAD_ENABLED ? downloadTrack : downloadDisabled);

export default router;

