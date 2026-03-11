import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth';
import {
  createPlaylist,
  getPlaylists,
  getPlaylistById,
  updatePlaylist,
  deletePlaylist,
  addTrackToPlaylist,
  removeTrackFromPlaylist,
  reorderPlaylistTracks,
} from '../controllers/playlistController';

const router = Router();

// All playlist routes require authentication
router.use(authenticateJWT as any);

router.post('/', createPlaylist);
router.get('/', getPlaylists);
router.get('/:id', getPlaylistById);
router.put('/:id', updatePlaylist);
router.delete('/:id', deletePlaylist);
router.post('/:id/tracks', addTrackToPlaylist);
router.delete('/:id/tracks/:trackId', removeTrackFromPlaylist);
router.put('/:id/reorder', reorderPlaylistTracks);

export default router;

