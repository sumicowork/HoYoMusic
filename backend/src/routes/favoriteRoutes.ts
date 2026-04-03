import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { noStore } from '../middleware/cacheHeaders';
import { toggleFavorite, getFavorites, checkFavorites } from '../controllers/favoriteController';

const router = Router();

// All favorites routes require authentication
router.use(authenticateJWT as any);
router.use(noStore);

router.post('/toggle', toggleFavorite);
router.get('/', getFavorites);
router.post('/check', checkFavorites);

export default router;

