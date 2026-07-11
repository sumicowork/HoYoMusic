import { Router } from 'express';
import { authenticateAdmin } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import {
  commitMusicSourceImport,
  createMusicSourceCategory,
  createMusicSourceNode,
  deleteMusicSourceCategory,
  deleteMusicSourceNode,
  exportMusicSources,
  getMusicSourceImportCandidates,
  getMusicSourceCategories,
  getMusicSourceNodes,
  getTrackMusicSources,
  previewMusicSourceImport,
  updateMusicSourceCategory,
  updateMusicSourceNode,
  upsertTrackMusicSources,
} from '../controllers/musicSourceController';
import {
  createMusicSourceCategorySchema,
  createMusicSourceNodeSchema,
  exportMusicSourcesSchema,
  musicSourceImportCommitSchema,
  musicSourceImportPreviewSchema,
  upsertTrackMusicSourcesSchema,
  updateMusicSourceCategorySchema,
  updateMusicSourceNodeSchema,
} from '../validators/schemas';
import { cacheControl, CACHE_TTL } from '../middleware/cacheHeaders';

const router = Router();

// Library APIs
/**
 * @openapi
 * /music-sources/categories:
 *   get:
 *     tags: [MusicSources]
 *     summary: 获取音乐来源分类
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200':
 *         description: 分类列表
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
router.get('/categories', authenticateAdmin, cacheControl(CACHE_TTL.NONE), getMusicSourceCategories);

/**
 * @openapi
 * /music-sources/categories:
 *   post:
 *     tags: [MusicSources]
 *     summary: 创建音乐来源分类
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               game_id: { type: integer }
 *               name: { type: string }
 *               description: { type: string }
 *               display_order: { type: integer }
 *             required: [game_id, name]
 *     responses:
 *       '201':
 *         description: 创建成功
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
router.post('/categories', authenticateAdmin, validateBody(createMusicSourceCategorySchema), createMusicSourceCategory);

/**
 * @openapi
 * /music-sources/categories/{id}:
 *   put:
 *     tags: [MusicSources]
 *     summary: 更新音乐来源分类
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
 *               description: { type: string }
 *               display_order: { type: integer }
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
router.put('/categories/:id', authenticateAdmin, validateBody(updateMusicSourceCategorySchema), updateMusicSourceCategory);

/**
 * @openapi
 * /music-sources/categories/{id}:
 *   delete:
 *     tags: [MusicSources]
 *     summary: 删除音乐来源分类
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: 删除成功
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
router.delete('/categories/:id', authenticateAdmin, deleteMusicSourceCategory);

/**
 * @openapi
 * /music-sources/nodes:
 *   get:
 *     tags: [MusicSources]
 *     summary: 获取音乐来源节点
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200':
 *         description: 节点列表
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
router.get('/nodes', authenticateAdmin, cacheControl(CACHE_TTL.NONE), getMusicSourceNodes);

/**
 * @openapi
 * /music-sources/nodes:
 *   post:
 *     tags: [MusicSources]
 *     summary: 创建音乐来源节点
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               game_id: { type: integer }
 *               category_id: { type: integer }
 *               parent_id: { type: integer, nullable: true }
 *               name: { type: string }
 *               display_order: { type: integer }
 *             required: [game_id, category_id, name]
 *     responses:
 *       '201':
 *         description: 创建成功
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
router.post('/nodes', authenticateAdmin, validateBody(createMusicSourceNodeSchema), createMusicSourceNode);

/**
 * @openapi
 * /music-sources/nodes/{id}:
 *   put:
 *     tags: [MusicSources]
 *     summary: 更新音乐来源节点
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
router.put('/nodes/:id', authenticateAdmin, validateBody(updateMusicSourceNodeSchema), updateMusicSourceNode);

/**
 * @openapi
 * /music-sources/nodes/{id}:
 *   delete:
 *     tags: [MusicSources]
 *     summary: 删除音乐来源节点
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: 删除成功
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
router.delete('/nodes/:id', authenticateAdmin, deleteMusicSourceNode);

// Track relation APIs
/**
 * @openapi
 * /music-sources/tracks/{trackId}:
 *   get:
 *     tags: [MusicSources]
 *     summary: 获取曲目关联的音乐来源
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: trackId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: 关联列表
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
router.get('/tracks/:trackId', authenticateAdmin, cacheControl(CACHE_TTL.NONE), getTrackMusicSources);

/**
 * @openapi
 * /music-sources/tracks/{trackId}:
 *   post:
 *     tags: [MusicSources]
 *     summary: 设置曲目关联的音乐来源
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: trackId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sources: { type: array, items: { type: object } }
 *             required: [sources]
 *     responses:
 *       '200':
 *         description: 设置成功
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
router.post('/tracks/:trackId', authenticateAdmin, validateBody(upsertTrackMusicSourcesSchema), upsertTrackMusicSources);

// Import / export APIs
/**
 * @openapi
 * /music-sources/import/candidates:
 *   get:
 *     tags: [MusicSources]
 *     summary: 获取音乐来源导入候选
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200':
 *         description: 候选列表
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
router.get('/import/candidates', authenticateAdmin, cacheControl(CACHE_TTL.NONE), getMusicSourceImportCandidates);

/**
 * @openapi
 * /music-sources/import/preview:
 *   post:
 *     tags: [MusicSources]
 *     summary: 预览音乐来源导入
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               game_id: { type: integer }
 *               data: { type: array, items: { type: object } }
 *             required: [game_id, data]
 *     responses:
 *       '200':
 *         description: 预览结果
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
router.post('/import/preview', authenticateAdmin, validateBody(musicSourceImportPreviewSchema), previewMusicSourceImport);

/**
 * @openapi
 * /music-sources/import/commit:
 *   post:
 *     tags: [MusicSources]
 *     summary: 提交音乐来源导入
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               game_id: { type: integer }
 *               data: { type: array, items: { type: object } }
 *             required: [game_id, data]
 *     responses:
 *       '200':
 *         description: 导入完成
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
router.post('/import/commit', authenticateAdmin, validateBody(musicSourceImportCommitSchema), commitMusicSourceImport);

/**
 * @openapi
 * /music-sources/export:
 *   post:
 *     tags: [MusicSources]
 *     summary: 导出音乐来源
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               game_id: { type: integer }
 *             required: [game_id]
 *     responses:
 *       '200':
 *         description: 导出文件
 *       '401':
 *         description: 未认证
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/export', authenticateAdmin, validateBody(exportMusicSourcesSchema), exportMusicSources);

export default router;

