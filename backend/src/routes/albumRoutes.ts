import express from 'express';
import { getAlbums, getAlbumById, updateAlbum, downloadAlbum, uploadCover } from '../controllers/albumController';
import { coverUpload } from '../middleware/upload';
import passport from 'passport';

const router = express.Router();

// Public routes
router.get('/', getAlbums);
router.get('/:id', getAlbumById);
router.get('/:id/download', downloadAlbum);

// Protected routes
router.put('/:id', passport.authenticate('jwt', { session: false }), updateAlbum);
router.post('/:id/cover', passport.authenticate('jwt', { session: false }), coverUpload.single('cover'), uploadCover);

export default router;

