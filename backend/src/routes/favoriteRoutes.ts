import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { noStore } from '../middleware/cacheHeaders';
import { toggleFavorite, getFavorites, checkFavorites } from '../controllers/favoriteController';

const router = Router();

// All favorites routes require authentication
router.use(authenticateJWT as any);
router.use(noStore);

/**
 * @openapi
 * /favorites/toggle:
 *   post:
 *     tags: [Favorites]
 *     summary: 切换收藏状态
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               track_id: { type: integer }
 *             required: [track_id]
 *     responses:
 *       '200':
 *         description: 切换成功
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
router.post('/toggle', toggleFavorite);

/**
 * @openapi
 * /favorites:
 *   get:
 *     tags: [Favorites]
 *     summary: 获取收藏列表
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200':
 *         description: 收藏列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: array, items: { type: object } }
 *       '401':
 *         description: 未认证
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/', getFavorites);

/**
 * @openapi
 * /favorites/check:
 *   post:
 *     tags: [Favorites]
 *     summary: 批量检查收藏状态
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               track_ids: { type: array, items: { type: integer } }
 *             required: [track_ids]
 *     responses:
 *       '200':
 *         description: 检查结果
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
router.post('/check', checkFavorites);

export default router;

