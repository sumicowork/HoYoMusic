import express from 'express';
import {
  getArtists,
  getArtistById,
  updateArtist,
  mergeArtists,
  getAliases,
  deleteAlias,
  uploadArtistAvatar,
  getArtistAvatar,
  getAllArtistAvatars,
  mergeArtistRoles,
  getRoleAliases,
  deleteRoleAlias,
  getArtistRoles,
} from '../controllers/artistController';
import { coverUpload } from '../middleware/upload';
import { validateBody } from '../middleware/validate';
import { mergeArtistRolesSchema, mergeArtistsSchema, updateArtistSchema } from '../validators/schemas';
import { authenticateAdmin } from '../middleware/auth';

const router = express.Router();

// Public routes
router.get('/', getArtists);
router.get('/aliases', getAliases);
router.get('/roles', getArtistRoles);
router.get('/roles/aliases', getRoleAliases);
router.get('/avatars', getAllArtistAvatars);
router.get('/avatar/:name', getArtistAvatar);
router.get('/:id', getArtistById);

// Protected routes
router.post('/avatar/:name', authenticateAdmin, coverUpload.single('avatar'), uploadArtistAvatar);
router.post('/merge', authenticateAdmin, validateBody(mergeArtistsSchema), mergeArtists);
router.post('/roles/merge', authenticateAdmin, validateBody(mergeArtistRolesSchema), mergeArtistRoles);
router.delete('/aliases/:id', authenticateAdmin, deleteAlias);
router.delete('/roles/aliases/:id', authenticateAdmin, deleteRoleAlias);
router.put('/:id', authenticateAdmin, validateBody(updateArtistSchema), updateArtist);

export default router;

