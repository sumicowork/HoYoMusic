import express from 'express';
import { getAlbums, getAlbumById, updateAlbum, downloadAlbum, uploadCover, bulkUpdateGame, rescanDates } from '../controllers/albumController';
import { coverUpload } from '../middleware/upload';
import passport from 'passport';

const router = express.Router();

// Public routes
router.get('/', getAlbums);
router.get('/:id', getAlbumById);
router.get('/:id/download', downloadAlbum);

// Protected routes
router.put('/bulk-game', passport.authenticate('jwt', { session: false }), bulkUpdateGame);
router.put('/:id', passport.authenticate('jwt', { session: false }), updateAlbum);
router.post('/:id/cover', passport.authenticate('jwt', { session: false }), coverUpload.single('cover'), uploadCover);
router.post('/:id/rescan-dates', passport.authenticate('jwt', { session: false }), rescanDates);

export default router;

