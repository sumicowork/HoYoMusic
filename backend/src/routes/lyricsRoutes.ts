import { Router } from 'express';
import {
  uploadLyrics,
  getLyrics,
  updateLyrics,
  deleteLyrics,
  markTrackInstrumental,
  previewLyricsBatchImport,
  commitLyricsBatchImport,
} from '../controllers/lyricsController';
import { authenticateAdmin } from '../middleware/auth';
import { lyricsBatchUpload } from '../middleware/upload';

const router = Router();

// Admin routes - require authentication
/**
 * @openapi
 * /lyrics/import/preview:
 *   post:
 *     tags: [Lyrics]
 *     summary: 批量导入歌词预览
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               files: { type: array, items: { type: string, format: binary } }
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
router.post('/import/preview', authenticateAdmin, lyricsBatchUpload.array('files', 200), previewLyricsBatchImport);

/**
 * @openapi
 * /lyrics/import/commit:
 *   post:
 *     tags: [Lyrics]
 *     summary: 批量导入歌词提交
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               files: { type: array, items: { type: string, format: binary } }
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
router.post('/import/commit', authenticateAdmin, lyricsBatchUpload.array('files', 200), commitLyricsBatchImport);

/**
 * @openapi
 * /lyrics/{id}/lyrics:
 *   post:
 *     tags: [Lyrics]
 *     summary: 上传曲目歌词
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
 *               file: { type: string, format: binary }
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
router.post('/:id/lyrics', authenticateAdmin, uploadLyrics);

/**
 * @openapi
 * /lyrics/{id}/lyrics:
 *   put:
 *     tags: [Lyrics]
 *     summary: 更新曲目歌词
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
 *               content: { type: string }
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
router.put('/:id/lyrics', authenticateAdmin, updateLyrics);

/**
 * @openapi
 * /lyrics/{id}/lyrics:
 *   delete:
 *     tags: [Lyrics]
 *     summary: 删除曲目歌词
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
router.delete('/:id/lyrics', authenticateAdmin, deleteLyrics);

/**
 * @openapi
 * /lyrics/{id}/instrumental:
 *   post:
 *     tags: [Lyrics]
 *     summary: 标记曲目为纯音乐（无歌词）
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: 标记成功
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
router.post('/:id/instrumental', authenticateAdmin, markTrackInstrumental);

// Public route - no authentication required
/**
 * @openapi
 * /lyrics/{id}/lyrics:
 *   get:
 *     tags: [Lyrics]
 *     summary: 获取曲目歌词（公开）
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: 歌词内容
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { type: object }
 *       '404':
 *         description: 歌词不存在
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/:id/lyrics', getLyrics);

export default router;

