import express from 'express';
import {
  getArtists,
  getArtistById,
  updateArtist,
  mergeArtists,
  getAliases,
  deleteAlias,
  uploadArtistAvatar,
  getArtistAvatar,
  getAllArtistAvatars,
  mergeArtistRoles,
  getRoleAliases,
  deleteRoleAlias,
  getArtistRoles,
} from '../controllers/artistController';
import { coverUpload } from '../middleware/upload';
import { validateBody } from '../middleware/validate';
import { mergeArtistRolesSchema, mergeArtistsSchema, updateArtistSchema } from '../validators/schemas';
import { authenticateAdmin } from '../middleware/auth';

const router = express.Router();

// Public routes
/**
 * @openapi
 * /artists:
 *   get:
 *     tags: [Artists]
 *     summary: 获取艺术家列表
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: 艺术家列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     artists: { type: array, items: { type: object } }
 *                     pagination: { type: object }
 *       '500':
 *         description: 服务器错误
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/', getArtists);

/**
 * @openapi
 * /artists/aliases:
 *   get:
 *     tags: [Artists]
 *     summary: 获取艺术家别名列表
 *     responses:
 *       '200':
 *         description: 别名列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: array, items: { type: object } }
 */
router.get('/aliases', getAliases);

/**
 * @openapi
 * /artists/roles:
 *   get:
 *     tags: [Artists]
 *     summary: 获取艺术家角色列表
 *     responses:
 *       '200':
 *         description: 角色列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: array, items: { type: object } }
 */
router.get('/roles', getArtistRoles);

/**
 * @openapi
 * /artists/roles/aliases:
 *   get:
 *     tags: [Artists]
 *     summary: 获取角色别名列表
 *     responses:
 *       '200':
 *         description: 角色别名列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: array, items: { type: object } }
 */
router.get('/roles/aliases', getRoleAliases);

/**
 * @openapi
 * /artists/avatars:
 *   get:
 *     tags: [Artists]
 *     summary: 获取所有艺术家头像
 *     responses:
 *       '200':
 *         description: 头像列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: array, items: { type: object } }
 */
router.get('/avatars', getAllArtistAvatars);

/**
 * @openapi
 * /artists/avatar/{name}:
 *   get:
 *     tags: [Artists]
 *     summary: 获取指定艺术家头像
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: 头像图片
 *       '404':
 *         description: 头像不存在
 */
router.get('/avatar/:name', getArtistAvatar);

/**
 * @openapi
 * /artists/{id}:
 *   get:
 *     tags: [Artists]
 *     summary: 获取艺术家详情
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: 艺术家详情
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       '404':
 *         description: 艺术家不存在
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/:id', getArtistById);

// Protected routes
/**
 * @openapi
 * /artists/avatar/{name}:
 *   post:
 *     tags: [Artists]
 *     summary: 上传艺术家头像
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               avatar: { type: string, format: binary }
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
router.post('/avatar/:name', authenticateAdmin, coverUpload.single('avatar'), uploadArtistAvatar);

/**
 * @openapi
 * /artists/merge:
 *   post:
 *     tags: [Artists]
 *     summary: 合并艺术家
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               source_ids: { type: array, items: { type: integer } }
 *               target_id: { type: integer }
 *             required: [source_ids, target_id]
 *     responses:
 *       '200':
 *         description: 合并成功
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
router.post('/merge', authenticateAdmin, validateBody(mergeArtistsSchema), mergeArtists);

/**
 * @openapi
 * /artists/roles/merge:
 *   post:
 *     tags: [Artists]
 *     summary: 合并艺术家角色
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               source_roles: { type: array, items: { type: string } }
 *               target_role: { type: string }
 *             required: [source_roles, target_role]
 *     responses:
 *       '200':
 *         description: 合并成功
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
router.post('/roles/merge', authenticateAdmin, validateBody(mergeArtistRolesSchema), mergeArtistRoles);

/**
 * @openapi
 * /artists/aliases/{id}:
 *   delete:
 *     tags: [Artists]
 *     summary: 删除艺术家别名
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
router.delete('/aliases/:id', authenticateAdmin, deleteAlias);

/**
 * @openapi
 * /artists/roles/aliases/{id}:
 *   delete:
 *     tags: [Artists]
 *     summary: 删除角色别名
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
router.delete('/roles/aliases/:id', authenticateAdmin, deleteRoleAlias);

/**
 * @openapi
 * /artists/{id}:
 *   put:
 *     tags: [Artists]
 *     summary: 更新艺术家信息
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
router.put('/:id', authenticateAdmin, validateBody(updateArtistSchema), updateArtist);

export default router;

