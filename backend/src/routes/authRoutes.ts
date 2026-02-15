import { Router } from 'express';
import { login, getCurrentUser } from '../controllers/authController';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

router.post('/login', login);
router.get('/me', authenticateJWT, getCurrentUser);

export default router;
