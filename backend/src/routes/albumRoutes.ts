import express from 'express';
import {
  getAlbums,
  getAlbumById,
  updateAlbum,
  downloadAlbum,
  uploadCover,
  bulkUpdateGame,
  rescanDates,
  detectAlbumBpm,
  createAlbumBpmTask,
  getAlbumBpmTask,
} from '../controllers/albumController';
import { coverUpload } from '../middleware/upload';
import { validateBody } from '../middleware/validate';
import { updateAlbumSchema, bulkUpdateGameSchema } from '../validators/schemas';
import { cacheControl, CACHE_TTL } from '../middleware/cacheHeaders';
import { authenticateAdmin } from '../middleware/auth';

const router = express.Router();

// Public routes (cached)
router.get('/', cacheControl(CACHE_TTL.MEDIUM), getAlbums);
router.get('/:id', cacheControl(CACHE_TTL.SHORT), getAlbumById);
router.get('/:id/download', downloadAlbum);

// Protected routes
router.put('/bulk-game', authenticateAdmin, validateBody(bulkUpdateGameSchema), bulkUpdateGame);
router.put('/:id', authenticateAdmin, validateBody(updateAlbumSchema), updateAlbum);
router.post('/:id/cover', authenticateAdmin, coverUpload.single('cover'), uploadCover);
router.post('/:id/rescan-dates', authenticateAdmin, rescanDates);
router.post('/:id/detect-bpm', authenticateAdmin, detectAlbumBpm);
router.post('/:id/detect-bpm/tasks', authenticateAdmin, createAlbumBpmTask);
router.get('/:id/detect-bpm/tasks/:taskId', authenticateAdmin, getAlbumBpmTask);

export default router;

