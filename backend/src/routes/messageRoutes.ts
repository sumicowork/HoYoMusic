import { Router } from 'express';
import { authenticateAdmin, authenticateJWT } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import {
  getInboxMessages,
  getUnreadCount,
  listSentMessages,
  markAllMessagesRead,
  markMessageRead,
  sendSiteMessage,
} from '../controllers/messageController';
import { sendSiteMessageSchema } from '../validators/schemas';

const router = Router();

router.use(authenticateJWT as any);

router.get('/inbox', getInboxMessages);
router.get('/unread-count', getUnreadCount);
router.post('/read-all', markAllMessagesRead);
router.post('/:deliveryId/read', markMessageRead);

router.post('/admin/send', authenticateAdmin, validateBody(sendSiteMessageSchema), sendSiteMessage);
router.get('/admin/sent', authenticateAdmin, listSentMessages);

export default router;

