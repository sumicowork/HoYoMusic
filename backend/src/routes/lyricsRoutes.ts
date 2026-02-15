import { Router } from 'express';
import { uploadLyrics, getLyrics, updateLyrics, deleteLyrics } from '../controllers/lyricsController';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

// Admin routes - require authentication
router.post('/:id/lyrics', authenticateJWT, uploadLyrics);
router.put('/:id/lyrics', authenticateJWT, updateLyrics);
router.delete('/:id/lyrics', authenticateJWT, deleteLyrics);

// Public route - no authentication required
router.get('/:id/lyrics', getLyrics);

export default router;

