import express from 'express';
import { getAlbums, getAlbumById, updateAlbum, downloadAlbum, uploadCover, bulkUpdateGame, rescanDates } from '../controllers/albumController';
import { coverUpload } from '../middleware/upload';
import passport from 'passport';
import { validateBody } from '../middleware/validate';
import { updateAlbumSchema, bulkUpdateGameSchema } from '../validators/schemas';
import { cacheControl, CACHE_TTL } from '../middleware/cacheHeaders';

const router = express.Router();

// Public routes (cached)
router.get('/', cacheControl(CACHE_TTL.MEDIUM), getAlbums);
router.get('/:id', cacheControl(CACHE_TTL.SHORT), getAlbumById);
router.get('/:id/download', downloadAlbum);

// Protected routes
router.put('/bulk-game', passport.authenticate('jwt', { session: false }), validateBody(bulkUpdateGameSchema), bulkUpdateGame);
router.put('/:id', passport.authenticate('jwt', { session: false }), validateBody(updateAlbumSchema), updateAlbum);
router.post('/:id/cover', passport.authenticate('jwt', { session: false }), coverUpload.single('cover'), uploadCover);
router.post('/:id/rescan-dates', passport.authenticate('jwt', { session: false }), rescanDates);

export default router;

