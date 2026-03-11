import express from 'express';
import { getGames, getGameById, updateGame, createGame, uploadGameCover } from '../controllers/gameController';
import { coverUpload } from '../middleware/upload';
import passport from 'passport';
import { validateBody } from '../middleware/validate';
import { createGameSchema, updateGameSchema } from '../validators/schemas';
import { cacheControl, CACHE_TTL } from '../middleware/cacheHeaders';

const router = express.Router();

// Public routes (cached)
router.get('/', cacheControl(CACHE_TTL.LONG), getGames);
router.get('/:id', cacheControl(CACHE_TTL.MEDIUM), getGameById);

// Protected routes
router.post('/', passport.authenticate('jwt', { session: false }), validateBody(createGameSchema), createGame);
router.put('/:id', passport.authenticate('jwt', { session: false }), validateBody(updateGameSchema), updateGame);
router.post('/:id/cover', passport.authenticate('jwt', { session: false }), coverUpload.single('cover'), uploadGameCover);

export default router;

