import express from 'express';
import { getArtists, getArtistById, updateArtist, mergeArtists, getAliases, deleteAlias, uploadArtistAvatar, getArtistAvatar, getAllArtistAvatars } from '../controllers/artistController';
import { coverUpload } from '../middleware/upload';
import { validateBody } from '../middleware/validate';
import { mergeArtistsSchema, updateArtistSchema } from '../validators/schemas';
import { authenticateAdmin } from '../middleware/auth';

const router = express.Router();

// Public routes
router.get('/', getArtists);
router.get('/aliases', getAliases);
router.get('/avatars', getAllArtistAvatars);
router.get('/avatar/:name', getArtistAvatar);
router.get('/:id', getArtistById);

// Protected routes
router.post('/avatar/:name', authenticateAdmin, coverUpload.single('avatar'), uploadArtistAvatar);
router.post('/merge', authenticateAdmin, validateBody(mergeArtistsSchema), mergeArtists);
router.delete('/aliases/:id', authenticateAdmin, deleteAlias);
router.put('/:id', authenticateAdmin, validateBody(updateArtistSchema), updateArtist);

export default router;

