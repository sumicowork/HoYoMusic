import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { noStore } from '../middleware/cacheHeaders';
import {
  createPlaylist,
  getPlaylists,
  getPlaylistById,
  updatePlaylist,
  deletePlaylist,
  addTrackToPlaylist,
  removeTrackFromPlaylist,
  reorderPlaylistTracks,
} from '../controllers/playlistController';

const router = Router();

// All playlist routes require authentication
router.use(authenticateJWT as any);
router.use(noStore);

/**
 * @openapi
 * /playlists:
 *   post:
 *     tags: [Playlists]
 *     summary: 创建播放列表
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
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
 *                 data: { $ref: '#/components/schemas/Playlist' }
 *       '401':
 *         description: 未认证
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.post('/', createPlaylist);

/**
 * @openapi
 * /playlists:
 *   get:
 *     tags: [Playlists]
 *     summary: 获取播放列表
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200':
 *         description: 播放列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: array, items: { $ref: '#/components/schemas/Playlist' } }
 *       '401':
 *         description: 未认证
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/', getPlaylists);

/**
 * @openapi
 * /playlists/{id}:
 *   get:
 *     tags: [Playlists]
 *     summary: 获取播放列表详情
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: 播放列表详情
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
 *       '404':
 *         description: 播放列表不存在
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/:id', getPlaylistById);

/**
 * @openapi
 * /playlists/{id}:
 *   put:
 *     tags: [Playlists]
 *     summary: 更新播放列表
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
router.put('/:id', updatePlaylist);

/**
 * @openapi
 * /playlists/{id}:
 *   delete:
 *     tags: [Playlists]
 *     summary: 删除播放列表
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
router.delete('/:id', deletePlaylist);

/**
 * @openapi
 * /playlists/{id}/tracks:
 *   post:
 *     tags: [Playlists]
 *     summary: 向播放列表添加曲目
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
 *               track_id: { type: integer }
 *             required: [track_id]
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
router.post('/:id/tracks', addTrackToPlaylist);

/**
 * @openapi
 * /playlists/{id}/tracks/{trackId}:
 *   delete:
 *     tags: [Playlists]
 *     summary: 从播放列表移除曲目
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: trackId
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
router.delete('/:id/tracks/:trackId', removeTrackFromPlaylist);

/**
 * @openapi
 * /playlists/{id}/reorder:
 *   put:
 *     tags: [Playlists]
 *     summary: 重排播放列表曲目
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
 *               ordered_track_ids: { type: array, items: { type: integer } }
 *             required: [ordered_track_ids]
 *     responses:
 *       '200':
 *         description: 重排成功
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
router.put('/:id/reorder', reorderPlaylistTracks);

export default router;

