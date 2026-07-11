import express from 'express';
import { authenticateAdmin } from '../middleware/auth';
import {
  getDiscsByAlbum,
  createDisc,
  updateDisc,
  deleteDisc,
  assignTrackToDisc,
  bulkAssignTracksToDisc,
} from '../controllers/discController';

const router = express.Router();
const auth = authenticateAdmin;

// Public routes
/**
 * @openapi
 * /albums/{albumId}/discs:
 *   get:
 *     tags: [Discs]
 *     summary: 获取专辑的分碟列表
 *     parameters:
 *       - in: path
 *         name: albumId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: 分碟列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: array, items: { type: object } }
 *       '404':
 *         description: 专辑不存在
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/albums/:albumId/discs', getDiscsByAlbum);

// Protected routes
/**
 * @openapi
 * /albums/{albumId}/discs:
 *   post:
 *     tags: [Discs]
 *     summary: 创建分碟
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: albumId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               disc_number: { type: integer }
 *               disc_title: { type: string }
 *             required: [disc_number]
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
router.post('/albums/:albumId/discs', auth, createDisc);

/**
 * @openapi
 * /albums/{albumId}/discs/assign:
 *   post:
 *     tags: [Discs]
 *     summary: 批量将曲目分配到分碟
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: albumId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               disc_id: { type: integer }
 *               track_ids: { type: array, items: { type: integer } }
 *             required: [disc_id, track_ids]
 *     responses:
 *       '200':
 *         description: 分配成功
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
router.post('/albums/:albumId/discs/assign', auth, bulkAssignTracksToDisc);

/**
 * @openapi
 * /discs/{id}:
 *   put:
 *     tags: [Discs]
 *     summary: 更新分碟信息
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
 *               disc_number: { type: integer }
 *               disc_title: { type: string }
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
router.put('/discs/:id', auth, updateDisc);

/**
 * @openapi
 * /discs/{id}:
 *   delete:
 *     tags: [Discs]
 *     summary: 删除分碟
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
router.delete('/discs/:id', auth, deleteDisc);

/**
 * @openapi
 * /tracks/{trackId}/disc:
 *   put:
 *     tags: [Discs]
 *     summary: 将曲目分配到指定分碟
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
 *               disc_id: { type: integer, nullable: true }
 *             required: [disc_id]
 *     responses:
 *       '200':
 *         description: 分配成功
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
router.put('/tracks/:trackId/disc', auth, assignTrackToDisc);

export default router;

