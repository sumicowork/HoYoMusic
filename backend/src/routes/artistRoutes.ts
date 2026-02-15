import express from 'express';
import { getArtists, getArtistById, updateArtist } from '../controllers/artistController';
import passport from 'passport';

const router = express.Router();

// Public routes
router.get('/', getArtists);
router.get('/:id', getArtistById);

// Protected routes
router.put('/:id', passport.authenticate('jwt', { session: false }), updateArtist);

export default router;

