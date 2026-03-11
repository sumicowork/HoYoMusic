import express from 'express';
import { getArtists, getArtistById, updateArtist, mergeArtists, getAliases, deleteAlias, uploadArtistAvatar, getArtistAvatar, getAllArtistAvatars } from '../controllers/artistController';
import { coverUpload } from '../middleware/upload';
import passport from 'passport';
import { validateBody } from '../middleware/validate';
import { mergeArtistsSchema } from '../validators/schemas';

const router = express.Router();

// Public routes
router.get('/', getArtists);
router.get('/aliases', getAliases);
router.get('/avatars', getAllArtistAvatars);
router.get('/avatar/:name', getArtistAvatar);
router.get('/:id', getArtistById);

// Protected routes
router.post('/avatar/:name', passport.authenticate('jwt', { session: false }), coverUpload.single('avatar'), uploadArtistAvatar);
router.post('/merge', passport.authenticate('jwt', { session: false }), validateBody(mergeArtistsSchema), mergeArtists);
router.delete('/aliases/:id', passport.authenticate('jwt', { session: false }), deleteAlias);
router.put('/:id', passport.authenticate('jwt', { session: false }), updateArtist);

export default router;

