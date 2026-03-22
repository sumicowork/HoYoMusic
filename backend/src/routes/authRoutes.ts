import { Router } from 'express';
import {
  login,
  getCurrentUser,
  changePassword,
  sendRegistrationVerificationCode,
  register,
} from '../controllers/authController';
import { authenticateJWT } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { loginSchema, sendVerificationCodeSchema, registerSchema } from '../validators/schemas';

const router = Router();

router.post('/login', validateBody(loginSchema), login);
router.post('/send-verification-code', validateBody(sendVerificationCodeSchema), sendRegistrationVerificationCode);
router.post('/register', validateBody(registerSchema), register);
router.get('/me', authenticateJWT, getCurrentUser);
router.post('/change-password', authenticateJWT as any, changePassword);

export default router;
