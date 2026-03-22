import express from 'express';
import { getGames, getGameById, updateGame, createGame, uploadGameCover } from '../controllers/gameController';
import { coverUpload } from '../middleware/upload';
import { validateBody } from '../middleware/validate';
import { createGameSchema, updateGameSchema } from '../validators/schemas';
import { cacheControl, CACHE_TTL } from '../middleware/cacheHeaders';
import { authenticateAdmin } from '../middleware/auth';

const router = express.Router();

// Public routes (cached)
router.get('/', cacheControl(CACHE_TTL.LONG), getGames);
router.get('/:id', cacheControl(CACHE_TTL.MEDIUM), getGameById);

// Protected routes
router.post('/', authenticateAdmin, validateBody(createGameSchema), createGame);
router.put('/:id', authenticateAdmin, validateBody(updateGameSchema), updateGame);
router.post('/:id/cover', authenticateAdmin, coverUpload.single('cover'), uploadGameCover);

export default router;

