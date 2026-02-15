import express from 'express';
import { getGames, getGameById, updateGame } from '../controllers/gameController';
import passport from 'passport';

const router = express.Router();

// Public routes
router.get('/', getGames);
router.get('/:id', getGameById);

// Protected routes
router.put('/:id', passport.authenticate('jwt', { session: false }), updateGame);

export default router;

