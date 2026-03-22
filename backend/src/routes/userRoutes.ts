import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { listUsers } from '../controllers/userController';

const router = Router();

router.get('/', authenticateJWT, listUsers);

export default router;

