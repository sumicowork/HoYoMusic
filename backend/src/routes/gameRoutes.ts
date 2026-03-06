import express from 'express';
import { getGames, getGameById, updateGame, createGame, uploadGameCover } from '../controllers/gameController';
import { coverUpload } from '../middleware/upload';
import passport from 'passport';

const router = express.Router();

// Public routes
router.get('/', getGames);
router.get('/:id', getGameById);

// Protected routes
router.post('/', passport.authenticate('jwt', { session: false }), createGame);
router.put('/:id', passport.authenticate('jwt', { session: false }), updateGame);
router.post('/:id/cover', passport.authenticate('jwt', { session: false }), coverUpload.single('cover'), uploadGameCover);

export default router;

