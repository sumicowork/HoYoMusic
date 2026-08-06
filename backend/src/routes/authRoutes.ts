import { Router } from 'express';
import {
  login,
  getCurrentUser,
  changePassword,
  sendRegistrationVerificationCode,
  register,
  sendPhoneCode,
  bindPhone,
} from '../controllers/authController';
import { authenticateJWT } from '../middleware/auth';
import { noStore } from '../middleware/cacheHeaders';
import { validateBody } from '../middleware/validate';
import { loginSchema, sendVerificationCodeSchema, registerSchema } from '../validators/schemas';

const router = Router();

router.use(noStore);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: 用户登录
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username: { type: string }
 *               password: { type: string }
 *             required: [username, password]
 *     responses:
 *       '200':
 *         description: 登录成功，返回 JWT Token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       '401':
 *         description: 凭证无效
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/login', validateBody(loginSchema), login);

/**
 * @openapi
 * /auth/send-verification-code:
 *   post:
 *     tags: [Auth]
 *     summary: 发送注册验证码
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: string }
 *             required: [email]
 *     responses:
 *       '200':
 *         description: 验证码已发送
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       '400':
 *         description: 参数错误
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/send-verification-code', validateBody(sendVerificationCodeSchema), sendRegistrationVerificationCode);

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: 用户注册
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username: { type: string }
 *               email: { type: string }
 *               password: { type: string }
 *               code: { type: string }
 *             required: [username, email, password, code]
 *     responses:
 *       '201':
 *         description: 注册成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       '400':
 *         description: 参数错误或验证码无效
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/register', validateBody(registerSchema), register);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: 获取当前用户信息
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200':
 *         description: 当前用户
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
router.get('/me', authenticateJWT, getCurrentUser);

/**
 * @openapi
 * /auth/change-password:
 *   post:
 *     tags: [Auth]
 *     summary: 修改密码
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               currentPassword: { type: string }
 *               newPassword: { type: string }
 *             required: [currentPassword, newPassword]
 *     responses:
 *       '200':
 *         description: 修改成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       '401':
 *         description: 原密码错误
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/change-password', authenticateJWT as any, changePassword);

// 手机号实名（评论功能前置：后台实名认证）
router.post('/send-phone-code', sendPhoneCode);
router.post('/bind-phone', authenticateJWT as any, bindPhone);

export default router;
