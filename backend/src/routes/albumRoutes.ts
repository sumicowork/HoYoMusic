import express from 'express';
import {
  getAlbums,
  getAlbumById,
  updateAlbum,
  downloadAlbum,
  uploadCover,
  bulkUpdateGame,
  rescanDates,
  detectAlbumBpm,
  createAlbumBpmTask,
  getAlbumBpmTask,
} from '../controllers/albumController';
import { coverUpload } from '../middleware/upload';
import { validateBody } from '../middleware/validate';
import { updateAlbumSchema, bulkUpdateGameSchema } from '../validators/schemas';
import { cacheControl, CACHE_TTL } from '../middleware/cacheHeaders';
import { authenticateAdmin } from '../middleware/auth';

const router = express.Router();

// Public routes (cached)
/**
 * @openapi
 * /albums:
 *   get:
 *     tags: [Albums]
 *     summary: 获取所有专辑
 *     parameters:
 *       - in: query
 *         name: game_id
 *         schema: { type: integer }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: 专辑列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     albums: { type: array, items: { $ref: '#/components/schemas/Album' } }
 *                     pagination: { type: object }
 *       '500':
 *         description: 服务器错误
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/', cacheControl(CACHE_TTL.MEDIUM), getAlbums);

/**
 * @openapi
 * /albums/{id}:
 *   get:
 *     tags: [Albums]
 *     summary: 获取专辑详情
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: 专辑详情
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/Album' }
 *       '404':
 *         description: 专辑不存在
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/:id', cacheControl(CACHE_TTL.SHORT), getAlbumById);

/**
 * @openapi
 * /albums/{id}/download:
 *   get:
 *     tags: [Albums]
 *     summary: 下载整张专辑（打包）
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: 专辑打包文件（二进制流）
 *       '404':
 *         description: 专辑不存在
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/:id/download', downloadAlbum);

// Protected routes
/**
 * @openapi
 * /albums/bulk-game:
 *   put:
 *     tags: [Albums]
 *     summary: 批量更新专辑所属游戏
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               album_ids: { type: array, items: { type: integer } }
 *               game_id: { type: integer, nullable: true }
 *             required: [album_ids]
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
router.put('/bulk-game', authenticateAdmin, validateBody(bulkUpdateGameSchema), bulkUpdateGame);

/**
 * @openapi
 * /albums/{id}:
 *   put:
 *     tags: [Albums]
 *     summary: 更新专辑信息
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
 *               title: { type: string }
 *               game_id: { type: integer, nullable: true }
 *               release_date: { type: string, format: date }
 *               notes: { type: string }
 *     responses:
 *       '200':
 *         description: 更新成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/Album' }
 *       '401':
 *         description: 未认证
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       '404':
 *         description: 专辑不存在
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.put('/:id', authenticateAdmin, validateBody(updateAlbumSchema), updateAlbum);

/**
 * @openapi
 * /albums/{id}/cover:
 *   post:
 *     tags: [Albums]
 *     summary: 上传专辑封面
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
router.post('/:id/cover', authenticateAdmin, coverUpload.single('cover'), uploadCover);

/**
 * @openapi
 * /albums/{id}/rescan-dates:
 *   post:
 *     tags: [Albums]
 *     summary: 重新扫描专辑发行日期
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: 扫描完成
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
router.post('/:id/rescan-dates', authenticateAdmin, rescanDates);

/**
 * @openapi
 * /albums/{id}/detect-bpm:
 *   post:
 *     tags: [Albums]
 *     summary: 检测专辑 BPM
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: 检测完成
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
router.post('/:id/detect-bpm', authenticateAdmin, detectAlbumBpm);

/**
 * @openapi
 * /albums/{id}/detect-bpm/tasks:
 *   post:
 *     tags: [Albums]
 *     summary: 创建专辑 BPM 检测任务
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: 任务已创建
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
router.post('/:id/detect-bpm/tasks', authenticateAdmin, createAlbumBpmTask);

/**
 * @openapi
 * /albums/{id}/detect-bpm/tasks/{taskId}:
 *   get:
 *     tags: [Albums]
 *     summary: 查询专辑 BPM 检测任务
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: 任务状态
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
router.get('/:id/detect-bpm/tasks/:taskId', authenticateAdmin, getAlbumBpmTask);

export default router;

