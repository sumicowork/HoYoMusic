import express from 'express';
import {
  getTags,
  getTagById,
  createTag,
  updateTag,
  deleteTag,
  getTrackTags,
  addTagToTrack,
  removeTagFromTrack,
  getTagGroups,
  getTagGroupById,
  createTagGroup,
  updateTagGroup,
  deleteTagGroup,
  bulkUpdateTrackTags
} from '../controllers/tagController';
import { authenticateAdmin } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import {
  createTagSchema,
  updateTagSchema,
  addTagToTrackSchema,
  bulkUpdateTrackTagsSchema,
  createTagGroupSchema,
  updateTagGroupSchema,
} from '../validators/schemas';

import { cacheControl, CACHE_TTL } from '../middleware/cacheHeaders';

const router = express.Router();

// ============ Tag Routes ============

// Public routes (cached)
/**
 * @openapi
 * /tags:
 *   get:
 *     tags: [Tags]
 *     summary: 获取所有标签
 *     responses:
 *       '200':
 *         description: 标签列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: array, items: { type: object } }
 *       '500':
 *         description: 服务器错误
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/', cacheControl(CACHE_TTL.SHORT), getTags);

/**
 * @openapi
 * /tags/{id}:
 *   get:
 *     tags: [Tags]
 *     summary: 获取标签详情
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: 标签详情
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       '404':
 *         description: 标签不存在
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/:id', cacheControl(CACHE_TTL.SHORT), getTagById);

/**
 * @openapi
 * /tags/track/{trackId}:
 *   get:
 *     tags: [Tags]
 *     summary: 获取曲目关联的标签
 *     parameters:
 *       - in: path
 *         name: trackId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: 标签列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: array, items: { type: object } }
 */
router.get('/track/:trackId', getTrackTags);

// Protected routes (require authentication)
/**
 * @openapi
 * /tags:
 *   post:
 *     tags: [Tags]
 *     summary: 创建标签
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               group_id: { type: integer, nullable: true }
 *               parent_id: { type: integer, nullable: true }
 *               display_order: { type: integer }
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
 *                 data: { type: object }
 *       '401':
 *         description: 未认证
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/', authenticateAdmin, validateBody(createTagSchema), createTag);

/**
 * @openapi
 * /tags/{id}:
 *   put:
 *     tags: [Tags]
 *     summary: 更新标签
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
 *               group_id: { type: integer, nullable: true }
 *               parent_id: { type: integer, nullable: true }
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
router.put('/:id', authenticateAdmin, validateBody(updateTagSchema), updateTag);

/**
 * @openapi
 * /tags/{id}:
 *   delete:
 *     tags: [Tags]
 *     summary: 删除标签
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
router.delete('/:id', authenticateAdmin, deleteTag);

/**
 * @openapi
 * /tags/bulk-update:
 *   post:
 *     tags: [Tags]
 *     summary: 批量更新曲目标签
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               track_ids: { type: array, items: { type: integer } }
 *               tag_ids: { type: array, items: { type: integer } }
 *             required: [track_ids]
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
router.post('/bulk-update', authenticateAdmin, validateBody(bulkUpdateTrackTagsSchema), bulkUpdateTrackTags);

// Track-Tag association (require authentication)
/**
 * @openapi
 * /tags/track/{trackId}:
 *   post:
 *     tags: [Tags]
 *     summary: 为曲目添加标签
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
 *               tag_id: { type: integer }
 *             required: [tag_id]
 *     responses:
 *       '201':
 *         description: 添加成功
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
router.post('/track/:trackId', authenticateAdmin, validateBody(addTagToTrackSchema), addTagToTrack);

/**
 * @openapi
 * /tags/track/{trackId}/{tagId}:
 *   delete:
 *     tags: [Tags]
 *     summary: 移除曲目标签
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: trackId
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: tagId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: 移除成功
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
router.delete('/track/:trackId/:tagId', authenticateAdmin, removeTagFromTrack);

// ============ Tag Group Routes ============

// Public routes
/**
 * @openapi
 * /tags/groups/all:
 *   get:
 *     tags: [Tags]
 *     summary: 获取所有标签分组
 *     responses:
 *       '200':
 *         description: 标签分组列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: array, items: { type: object } }
 */
router.get('/groups/all', getTagGroups);

/**
 * @openapi
 * /tags/groups/{id}:
 *   get:
 *     tags: [Tags]
 *     summary: 获取标签分组详情
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: 标签分组详情
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       '404':
 *         description: 分组不存在
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/groups/:id', getTagGroupById);

// Protected routes (require authentication)
/**
 * @openapi
 * /tags/groups:
 *   post:
 *     tags: [Tags]
 *     summary: 创建标签分组
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               icon: { type: string }
 *               display_order: { type: integer }
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
 *                 data: { type: object }
 *       '401':
 *         description: 未认证
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/groups', authenticateAdmin, validateBody(createTagGroupSchema), createTagGroup);

/**
 * @openapi
 * /tags/groups/{id}:
 *   put:
 *     tags: [Tags]
 *     summary: 更新标签分组
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
 *               icon: { type: string }
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
router.put('/groups/:id', authenticateAdmin, validateBody(updateTagGroupSchema), updateTagGroup);

/**
 * @openapi
 * /tags/groups/{id}:
 *   delete:
 *     tags: [Tags]
 *     summary: 删除标签分组
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
router.delete('/groups/:id', authenticateAdmin, deleteTagGroup);

export default router;

