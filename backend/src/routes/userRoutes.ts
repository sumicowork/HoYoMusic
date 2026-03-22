import { Router } from 'express';
import { authenticateAdmin } from '../middleware/auth';
import {
  listUsers,
  resetUserPassword,
  updateUserEmailVerification,
  updateUserRole,
  updateUserStatus,
} from '../controllers/userController';
import { validateBody } from '../middleware/validate';
import {
  resetUserPasswordSchema,
  updateUserEmailVerificationSchema,
  updateUserRoleSchema,
  updateUserStatusSchema,
} from '../validators/schemas';

const router = Router();

router.get('/', authenticateAdmin, listUsers);
router.patch('/:id/role', authenticateAdmin, validateBody(updateUserRoleSchema), updateUserRole);
router.patch('/:id/status', authenticateAdmin, validateBody(updateUserStatusSchema), updateUserStatus);
router.patch('/:id/email-verification', authenticateAdmin, validateBody(updateUserEmailVerificationSchema), updateUserEmailVerification);
router.post('/:id/reset-password', authenticateAdmin, validateBody(resetUserPasswordSchema), resetUserPassword);

export default router;

