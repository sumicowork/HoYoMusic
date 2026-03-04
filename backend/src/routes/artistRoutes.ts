import express from 'express';
import { getArtists, getArtistById, updateArtist, mergeArtists, getAliases, deleteAlias } from '../controllers/artistController';
import passport from 'passport';

const router = express.Router();

// Public routes
router.get('/', getArtists);
router.get('/aliases', getAliases);
router.get('/:id', getArtistById);

// Protected routes
router.post('/merge', passport.authenticate('jwt', { session: false }), mergeArtists);
router.delete('/aliases/:id', passport.authenticate('jwt', { session: false }), deleteAlias);
router.put('/:id', passport.authenticate('jwt', { session: false }), updateArtist);

export default router;

