import { Router } from 'express';
import {
  uploadLyrics,
  getLyrics,
  updateLyrics,
  deleteLyrics,
  previewLyricsBatchImport,
  commitLyricsBatchImport,
} from '../controllers/lyricsController';
import { authenticateJWT } from '../middleware/auth';
import { lyricsBatchUpload } from '../middleware/upload';

const router = Router();

// Admin routes - require authentication
router.post('/import/preview', authenticateJWT, lyricsBatchUpload.array('files', 200), previewLyricsBatchImport);
router.post('/import/commit', authenticateJWT, lyricsBatchUpload.array('files', 200), commitLyricsBatchImport);
router.post('/:id/lyrics', authenticateJWT, uploadLyrics);
router.put('/:id/lyrics', authenticateJWT, updateLyrics);
router.delete('/:id/lyrics', authenticateJWT, deleteLyrics);

// Public route - no authentication required
router.get('/:id/lyrics', getLyrics);

export default router;

