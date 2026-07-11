import express from 'express';
import { getGames, getGameById, updateGame, createGame, uploadGameCover } from '../controllers/gameController';
import { coverUpload } from '../middleware/upload';
import { validateBody } from '../middleware/validate';
import { createGameSchema, updateGameSchema } from '../validators/schemas';
import { cacheControl, CACHE_TTL } from '../middleware/cacheHeaders';
import { authenticateAdmin } from '../middleware/auth';

const router = express.Router();

// Public routes (cached)
/**
 * @openapi
 * /games:
 *   get:
 *     tags: [Games]
 *     summary: 获取所有游戏
 *     responses:
 *       '200':
 *         description: 游戏列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: array, items: { $ref: '#/components/schemas/Game' } }
 *       '500':
 *         description: 服务器错误
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/', cacheControl(CACHE_TTL.LONG), getGames);

/**
 * @openapi
 * /games/{id}:
 *   get:
 *     tags: [Games]
 *     summary: 获取游戏详情
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: 游戏详情
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/Game' }
 *       '404':
 *         description: 游戏不存在
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/:id', cacheControl(CACHE_TTL.MEDIUM), getGameById);

// Protected routes
/**
 * @openapi
 * /games:
 *   post:
 *     tags: [Games]
 *     summary: 创建游戏
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               display_order: { type: integer }
 *               status: { type: string, enum: ['active', 'inactive', 'maintenance', 'unreleased'] }
 *             required: [name]
 *     responses:
 *       '201':
 *         description: 创建成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/Game' }
 *       '401':
 *         description: 未认证
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/', authenticateAdmin, validateBody(createGameSchema), createGame);

/**
 * @openapi
 * /games/{id}:
 *   put:
 *     tags: [Games]
 *     summary: 更新游戏
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
 *               name: { type: string }
 *               display_order: { type: integer }
 *               status: { type: string, enum: ['active', 'inactive', 'maintenance', 'unreleased'] }
 *     responses:
 *       '200':
 *         description: 更新成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/Game' }
 *       '401':
 *         description: 未认证
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       '404':
 *         description: 游戏不存在
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.put('/:id', authenticateAdmin, validateBody(updateGameSchema), updateGame);

/**
 * @openapi
 * /games/{id}/cover:
 *   post:
 *     tags: [Games]
 *     summary: 上传游戏封面
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               cover: { type: string, format: binary }
 *     responses:
 *       '200':
 *         description: 上传成功
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
router.post('/:id/cover', authenticateAdmin, coverUpload.single('cover'), uploadGameCover);

export default router;

