import { Router, Request, Response } from 'express';
import { uploadTracks, getTracks, getTrackFilterOptions, getTrackById, streamTrack, downloadTrack, updateTrack, deleteTrack, uploadTrackCover, bulkDeleteTracks, bulkMoveTracksToAlbum, previewCredits, precheckDuplicateTracks, scanSameAlbumDuplicateTracks, previewTrackNotesImport, commitTrackNotesImport, getTrackNotesImportCandidates, exportAllTrackNotes } from '../controllers/trackController';
import { authenticateAdmin } from '../middleware/auth';
import { authenticateStream } from '../middleware/authenticateStream';
import upload, { coverUpload } from '../middleware/upload';
import { validateBody } from '../middleware/validate';
import { updateTrackSchema, bulkDeleteTracksSchema, bulkMoveTracksSchema, previewTrackNotesImportSchema, commitTrackNotesImportSchema } from '../validators/schemas';

const router = Router();

// ── 全局下载开关（通过环境变量 DOWNLOAD_ENABLED 控制）────────────
const DOWNLOAD_ENABLED = process.env.DOWNLOAD_ENABLED === 'true';
const downloadDisabled = (_req: Request, res: Response) =>
  res.status(503).json({ success: false, error: { code: 'DOWNLOAD_DISABLED', message: '下载功能暂时关闭，服务器维护中。' } });
// ──────────────────────────────────────────────────────────────────

// All track routes require authentication
router.post('/upload', authenticateAdmin, upload.array('tracks', 20), uploadTracks);
router.post('/precheck-duplicates', authenticateAdmin, precheckDuplicateTracks);
router.post('/preview-credits', authenticateAdmin, upload.array('tracks', 20), previewCredits);
router.post('/notes-import/preview', authenticateAdmin, validateBody(previewTrackNotesImportSchema), previewTrackNotesImport);
router.post('/notes-import/commit', authenticateAdmin, validateBody(commitTrackNotesImportSchema), commitTrackNotesImport);
router.get('/notes-import/candidates', authenticateAdmin, getTrackNotesImportCandidates);
router.get('/notes-export', authenticateAdmin, exportAllTrackNotes);
router.get('/duplicates/same-album-title', authenticateAdmin, scanSameAlbumDuplicateTracks);
router.delete('/bulk', authenticateAdmin, validateBody(bulkDeleteTracksSchema), bulkDeleteTracks);
router.post('/bulk-move', authenticateAdmin, validateBody(bulkMoveTracksSchema), bulkMoveTracksToAlbum);
router.get('/', authenticateAdmin, getTracks);
router.get('/filter-options', authenticateAdmin, getTrackFilterOptions);
router.get('/:id', authenticateAdmin, getTrackById);
router.put('/:id', authenticateAdmin, validateBody(updateTrackSchema), updateTrack);
router.delete('/:id', authenticateAdmin, deleteTrack);
router.post('/:id/cover', authenticateAdmin, coverUpload.single('cover'), uploadTrackCover);
router.get('/:id/stream', authenticateStream, streamTrack);
router.get('/:id/download', authenticateStream, DOWNLOAD_ENABLED ? downloadTrack : downloadDisabled);

export default router;

