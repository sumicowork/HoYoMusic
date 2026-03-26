import { Router } from 'express';
import {
  uploadLyrics,
  getLyrics,
  updateLyrics,
  deleteLyrics,
  markTrackInstrumental,
  previewLyricsBatchImport,
  commitLyricsBatchImport,
} from '../controllers/lyricsController';
import { authenticateAdmin } from '../middleware/auth';
import { lyricsBatchUpload } from '../middleware/upload';

const router = Router();

// Admin routes - require authentication
router.post('/import/preview', authenticateAdmin, lyricsBatchUpload.array('files', 200), previewLyricsBatchImport);
router.post('/import/commit', authenticateAdmin, lyricsBatchUpload.array('files', 200), commitLyricsBatchImport);
router.post('/:id/lyrics', authenticateAdmin, uploadLyrics);
router.put('/:id/lyrics', authenticateAdmin, updateLyrics);
router.delete('/:id/lyrics', authenticateAdmin, deleteLyrics);
router.post('/:id/instrumental', authenticateAdmin, markTrackInstrumental);

// Public route - no authentication required
router.get('/:id/lyrics', getLyrics);

export default router;

