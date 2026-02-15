import { Router } from 'express';
import { getCredits, addCredit, updateCredit, deleteCredit } from '../controllers/creditsController';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

// Get credits - public
router.get('/:id/credits', getCredits);

// Admin routes - require authentication
router.post('/:id/credits', authenticateJWT, addCredit);
router.put('/:id/credits/:creditId', authenticateJWT, updateCredit);
router.delete('/:id/credits/:creditId', authenticateJWT, deleteCredit);

export default router;

