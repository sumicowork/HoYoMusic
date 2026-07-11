import { Router } from 'express';
import { authenticateAdmin } from '../middleware/auth';
import { noStore } from '../middleware/cacheHeaders';
import {
  getUserFullProfile,
  getUserInsights,
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

router.use(noStore);

/**
 * @openapi
 * /users:
 *   get:
 *     tags: [Users]
 *     summary: 获取用户列表
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: 用户列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     users: { type: array, items: { type: object } }
 *                     pagination: { type: object }
 *       '401':
 *         description: 未认证
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/', authenticateAdmin, listUsers);

/**
 * @openapi
 * /users/{id}/insights:
 *   get:
 *     tags: [Users]
 *     summary: 获取用户行为洞察
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: 用户洞察
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
router.get('/:id/insights', authenticateAdmin, getUserInsights);

/**
 * @openapi
 * /users/{id}/full-profile:
 *   get:
 *     tags: [Users]
 *     summary: 获取用户完整档案
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: 用户档案
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
router.get('/:id/full-profile', authenticateAdmin, getUserFullProfile);

/**
 * @openapi
 * /users/{id}/role:
 *   patch:
 *     tags: [Users]
 *     summary: 更新用户角色
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               is_admin: { type: boolean }
 *             required: [is_admin]
 *     responses:
 *       '200':
 *         description: 更新成功
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
router.patch('/:id/role', authenticateAdmin, validateBody(updateUserRoleSchema), updateUserRole);

/**
 * @openapi
 * /users/{id}/status:
 *   patch:
 *     tags: [Users]
 *     summary: 更新用户状态
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               account_status: { type: string, enum: ['active', 'disabled'] }
 *               status_reason: { type: string }
 *             required: [account_status]
 *     responses:
 *       '200':
 *         description: 更新成功
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
router.patch('/:id/status', authenticateAdmin, validateBody(updateUserStatusSchema), updateUserStatus);

/**
 * @openapi
 * /users/{id}/email-verification:
 *   patch:
 *     tags: [Users]
 *     summary: 更新用户邮箱验证状态
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email_verified: { type: boolean }
 *             required: [email_verified]
 *     responses:
 *       '200':
 *         description: 更新成功
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
router.patch('/:id/email-verification', authenticateAdmin, validateBody(updateUserEmailVerificationSchema), updateUserEmailVerification);

/**
 * @openapi
 * /users/{id}/reset-password:
 *   post:
 *     tags: [Users]
 *     summary: 重置用户密码
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               new_password: { type: string }
 *             required: [new_password]
 *     responses:
 *       '200':
 *         description: 重置成功
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
router.post('/:id/reset-password', authenticateAdmin, validateBody(resetUserPasswordSchema), resetUserPassword);

export default router;

