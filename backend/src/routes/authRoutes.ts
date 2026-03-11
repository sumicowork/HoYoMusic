import { Router } from 'express';
import { login, getCurrentUser, changePassword } from '../controllers/authController';
import { authenticateJWT } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { loginSchema } from '../validators/schemas';

const router = Router();

router.post('/login', validateBody(loginSchema), login);
router.get('/me', authenticateJWT, getCurrentUser);
router.post('/change-password', authenticateJWT as any, changePassword);

export default router;
