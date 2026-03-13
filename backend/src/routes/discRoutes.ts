import express from 'express';
import passport from 'passport';
import {
  getDiscsByAlbum,
  createDisc,
  updateDisc,
  deleteDisc,
  assignTrackToDisc,
  bulkAssignTracksToDisc,
} from '../controllers/discController';

const router = express.Router();
const auth = passport.authenticate('jwt', { session: false });

// Public routes
router.get('/albums/:albumId/discs', getDiscsByAlbum);

// Protected routes
router.post('/albums/:albumId/discs', auth, createDisc);
router.post('/albums/:albumId/discs/assign', auth, bulkAssignTracksToDisc);
router.put('/discs/:id', auth, updateDisc);
router.delete('/discs/:id', auth, deleteDisc);
router.put('/tracks/:trackId/disc', auth, assignTrackToDisc);

export default router;

