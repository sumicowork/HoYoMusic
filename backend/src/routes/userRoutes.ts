import { Router } from 'express';
import { authenticateAdmin } from '../middleware/auth';
import { listUsers } from '../controllers/userController';

const router = Router();

router.get('/', authenticateAdmin, listUsers);

export default router;

