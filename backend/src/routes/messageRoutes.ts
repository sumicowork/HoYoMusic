import { Router } from 'express';
import { authenticateAdmin, authenticateJWT } from '../middleware/auth';
import { noStore } from '../middleware/cacheHeaders';
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
router.use(noStore);

/**
 * @openapi
 * /messages/inbox:
 *   get:
 *     tags: [Messages]
 *     summary: 获取收件箱消息
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200':
 *         description: 消息列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     messages: { type: array, items: { type: object } }
 *                     pagination: { type: object }
 *       '401':
 *         description: 未认证
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/inbox', getInboxMessages);

/**
 * @openapi
 * /messages/unread-count:
 *   get:
 *     tags: [Messages]
 *     summary: 获取未读消息数量
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200':
 *         description: 未读数量
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       '401':
 *         description: 未认证
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/unread-count', getUnreadCount);

/**
 * @openapi
 * /messages/read-all:
 *   post:
 *     tags: [Messages]
 *     summary: 标记全部消息为已读
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200':
 *         description: 操作成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       '401':
 *         description: 未认证
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/read-all', markAllMessagesRead);

/**
 * @openapi
 * /messages/{deliveryId}/read:
 *   post:
 *     tags: [Messages]
 *     summary: 标记单条消息为已读
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: deliveryId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: 操作成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       '401':
 *         description: 未认证
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/:deliveryId/read', markMessageRead);

/**
 * @openapi
 * /messages/admin/send:
 *   post:
 *     tags: [Messages]
 *     summary: 发送站内消息
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               content: { type: string }
 *               is_broadcast: { type: boolean }
 *               recipient_ids: { type: array, items: { type: integer } }
 *             required: [title, content]
 *     responses:
 *       '201':
 *         description: 发送成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       '401':
 *         description: 未认证
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/admin/send', authenticateAdmin, validateBody(sendSiteMessageSchema), sendSiteMessage);

/**
 * @openapi
 * /messages/admin/sent:
 *   get:
 *     tags: [Messages]
 *     summary: 获取已发送消息列表
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200':
 *         description: 已发送消息
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     messages: { type: array, items: { type: object } }
 *                     pagination: { type: object }
 *       '401':
 *         description: 未认证
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/admin/sent', authenticateAdmin, listSentMessages);

export default router;

