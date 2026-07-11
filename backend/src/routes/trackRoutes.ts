import { Router, Request, Response } from 'express';
import { uploadTracks, getTracks, getTrackFilterOptions, getTrackById, streamTrack, downloadTrack, updateTrack, clearTrackNotes, clearAllTrackNotes, deleteTrack, uploadTrackCover, bulkDeleteTracks, bulkMoveTracksToAlbum, previewCredits, precheckDuplicateTracks, scanSameAlbumDuplicateTracks, previewTrackNotesImport, commitTrackNotesImport, getTrackNotesImportCandidates, exportAllTrackNotes, exportCatalogMetadata, replaceCatalogMetadataByUuid, previewCatalogMetadataByUuid, commitCatalogMetadataByUuid, rollbackCatalogMetadataImportBatch } from '../controllers/trackController';
import { authenticateAdmin } from '../middleware/auth';
import { authenticateStream } from '../middleware/authenticateStream';
import upload, { coverUpload } from '../middleware/upload';
import { validateBody } from '../middleware/validate';
import { updateTrackSchema, bulkDeleteTracksSchema, bulkMoveTracksSchema, previewTrackNotesImportSchema, commitTrackNotesImportSchema, clearAllTrackNotesSchema, importCatalogMetadataByUuidSchema, previewCatalogMetadataByUuidSchema, commitCatalogMetadataByUuidSchema, rollbackCatalogMetadataBatchSchema } from '../validators/schemas';
import { cacheControl, CACHE_TTL, noStore } from '../middleware/cacheHeaders';

const router = Router();

// ── 全局下载开关（通过环境变量 DOWNLOAD_ENABLED 控制）────────────
const DOWNLOAD_ENABLED = process.env.DOWNLOAD_ENABLED === 'true';
const downloadDisabled = (_req: Request, res: Response) =>
  res.status(503).json({ success: false, error: { code: 'DOWNLOAD_DISABLED', message: '下载功能暂时关闭，服务器维护中。' } });
// ──────────────────────────────────────────────────────────────────

// All track routes require authentication
/**
 * @openapi
 * /tracks/upload:
 *   post:
 *     tags: [Tracks]
 *     summary: 上传曲目
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               tracks: { type: array, items: { type: string, format: binary } }
 *               album_id: { type: integer }
 *     responses:
 *       '201':
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
router.post('/upload', authenticateAdmin, upload.array('tracks', 20), uploadTracks);

/**
 * @openapi
 * /tracks/precheck-duplicates:
 *   post:
 *     tags: [Tracks]
 *     summary: 上传前预检重复曲目
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200':
 *         description: 预检结果
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
router.post('/precheck-duplicates', authenticateAdmin, precheckDuplicateTracks);

/**
 * @openapi
 * /tracks/preview-credits:
 *   post:
 *     tags: [Tracks]
 *     summary: 上传文件并预览制作人员信息
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               tracks: { type: array, items: { type: string, format: binary } }
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
router.post('/preview-credits', authenticateAdmin, upload.array('tracks', 20), previewCredits);

/**
 * @openapi
 * /tracks/notes-import/preview:
 *   post:
 *     tags: [Tracks]
 *     summary: 预览曲目备注导入
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               data: { type: array, items: { type: object } }
 *             required: [data]
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
router.post('/notes-import/preview', authenticateAdmin, validateBody(previewTrackNotesImportSchema), previewTrackNotesImport);

/**
 * @openapi
 * /tracks/notes-import/commit:
 *   post:
 *     tags: [Tracks]
 *     summary: 提交曲目备注导入
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               data: { type: array, items: { type: object } }
 *             required: [data]
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
router.post('/notes-import/commit', authenticateAdmin, validateBody(commitTrackNotesImportSchema), commitTrackNotesImport);

/**
 * @openapi
 * /tracks/notes/clear-all:
 *   post:
 *     tags: [Tracks]
 *     summary: 清空全部曲目备注
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               confirm: { type: boolean }
 *             required: [confirm]
 *     responses:
 *       '200':
 *         description: 清空成功
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
router.post('/notes/clear-all', authenticateAdmin, validateBody(clearAllTrackNotesSchema), clearAllTrackNotes);

/**
 * @openapi
 * /tracks/notes-import/candidates:
 *   get:
 *     tags: [Tracks]
 *     summary: 获取曲目备注导入候选
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
router.get('/notes-import/candidates', authenticateAdmin, cacheControl(CACHE_TTL.NONE), getTrackNotesImportCandidates);

/**
 * @openapi
 * /tracks/notes-export:
 *   get:
 *     tags: [Tracks]
 *     summary: 导出全部曲目备注
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200':
 *         description: 导出文件
 *       '401':
 *         description: 未认证
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/notes-export', authenticateAdmin, cacheControl(CACHE_TTL.NONE), exportAllTrackNotes);

/**
 * @openapi
 * /tracks/metadata-export:
 *   get:
 *     tags: [Tracks]
 *     summary: 导出目录元数据
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200':
 *         description: 导出文件
 *       '401':
 *         description: 未认证
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/metadata-export', authenticateAdmin, cacheControl(CACHE_TTL.NONE), exportCatalogMetadata);

/**
 * @openapi
 * /tracks/metadata-import/preview:
 *   post:
 *     tags: [Tracks]
 *     summary: 预览按 UUID 导入目录元数据
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               data: { type: array, items: { type: object } }
 *             required: [data]
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
router.post('/metadata-import/preview', authenticateAdmin, validateBody(previewCatalogMetadataByUuidSchema), noStore, previewCatalogMetadataByUuid);

/**
 * @openapi
 * /tracks/metadata-import/commit:
 *   post:
 *     tags: [Tracks]
 *     summary: 提交按 UUID 导入目录元数据
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               data: { type: array, items: { type: object } }
 *             required: [data]
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
router.post('/metadata-import/commit', authenticateAdmin, validateBody(commitCatalogMetadataByUuidSchema), noStore, commitCatalogMetadataByUuid);

/**
 * @openapi
 * /tracks/metadata-import/rollback:
 *   post:
 *     tags: [Tracks]
 *     summary: 回滚目录元数据导入批次
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               batch_uuid: { type: string, format: uuid }
 *             required: [batch_uuid]
 *     responses:
 *       '200':
 *         description: 回滚成功
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
router.post('/metadata-import/rollback', authenticateAdmin, validateBody(rollbackCatalogMetadataBatchSchema), noStore, rollbackCatalogMetadataImportBatch);

/**
 * @openapi
 * /tracks/metadata-import/replace-by-uuid:
 *   post:
 *     tags: [Tracks]
 *     summary: 按 UUID 替换目录元数据
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               data: { type: array, items: { type: object } }
 *             required: [data]
 *     responses:
 *       '200':
 *         description: 替换完成
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
router.post('/metadata-import/replace-by-uuid', authenticateAdmin, validateBody(importCatalogMetadataByUuidSchema), noStore, replaceCatalogMetadataByUuid);

/**
 * @openapi
 * /tracks/duplicates/same-album-title:
 *   get:
 *     tags: [Tracks]
 *     summary: 扫描同专辑同名重复曲目
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200':
 *         description: 重复列表
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
router.get('/duplicates/same-album-title', authenticateAdmin, cacheControl(CACHE_TTL.NONE), scanSameAlbumDuplicateTracks);

/**
 * @openapi
 * /tracks/bulk:
 *   delete:
 *     tags: [Tracks]
 *     summary: 批量删除曲目
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
router.delete('/bulk', authenticateAdmin, validateBody(bulkDeleteTracksSchema), bulkDeleteTracks);

/**
 * @openapi
 * /tracks/bulk-move:
 *   post:
 *     tags: [Tracks]
 *     summary: 批量移动曲目到专辑
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               track_ids: { type: array, items: { type: integer } }
 *               album_id: { type: integer }
 *             required: [track_ids, album_id]
 *     responses:
 *       '200':
 *         description: 移动成功
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
router.post('/bulk-move', authenticateAdmin, validateBody(bulkMoveTracksSchema), bulkMoveTracksToAlbum);

/**
 * @openapi
 * /tracks:
 *   get:
 *     tags: [Tracks]
 *     summary: 获取曲目列表
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: album_id
 *         schema: { type: integer }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: 曲目列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     tracks: { type: array, items: { $ref: '#/components/schemas/Track' } }
 *                     pagination: { type: object }
 *       '401':
 *         description: 未认证
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/', authenticateAdmin, cacheControl(CACHE_TTL.NONE), getTracks);

/**
 * @openapi
 * /tracks/filter-options:
 *   get:
 *     tags: [Tracks]
 *     summary: 获取曲目筛选选项
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       '200':
 *         description: 筛选选项
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
router.get('/filter-options', authenticateAdmin, cacheControl(CACHE_TTL.NONE), getTrackFilterOptions);

/**
 * @openapi
 * /tracks/{id}:
 *   get:
 *     tags: [Tracks]
 *     summary: 获取曲目详情
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: 曲目详情
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data: { $ref: '#/components/schemas/Track' }
 *       '401':
 *         description: 未认证
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       '404':
 *         description: 曲目不存在
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/:id', authenticateAdmin, cacheControl(CACHE_TTL.NONE), getTrackById);

/**
 * @openapi
 * /tracks/{id}:
 *   put:
 *     tags: [Tracks]
 *     summary: 更新曲目信息
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
 *               album_id: { type: integer, nullable: true }
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
 *                 data: { $ref: '#/components/schemas/Track' }
 *       '401':
 *         description: 未认证
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.put('/:id', authenticateAdmin, validateBody(updateTrackSchema), updateTrack);

/**
 * @openapi
 * /tracks/{id}/notes:
 *   delete:
 *     tags: [Tracks]
 *     summary: 清空曲目备注
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: 清空成功
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
router.delete('/:id/notes', authenticateAdmin, clearTrackNotes);

/**
 * @openapi
 * /tracks/{id}:
 *   delete:
 *     tags: [Tracks]
 *     summary: 删除曲目
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
router.delete('/:id', authenticateAdmin, deleteTrack);

/**
 * @openapi
 * /tracks/{id}/cover:
 *   post:
 *     tags: [Tracks]
 *     summary: 上传曲目封面
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
router.post('/:id/cover', authenticateAdmin, coverUpload.single('cover'), uploadTrackCover);

/**
 * @openapi
 * /tracks/{id}/stream:
 *   get:
 *     tags: [Tracks]
 *     summary: 流式播放曲目
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: 音频流（二进制）
 *       '404':
 *         description: 曲目不存在
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/:id/stream', authenticateStream, cacheControl(86400, { immutable: true }), streamTrack);

/**
 * @openapi
 * /tracks/{id}/download:
 *   get:
 *     tags: [Tracks]
 *     summary: 下载曲目
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       '200':
 *         description: 音频文件（二进制）
 *       '503':
 *         description: 下载功能已关闭
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
router.get('/:id/download', authenticateStream, cacheControl(86400, { immutable: true }), DOWNLOAD_ENABLED ? downloadTrack : downloadDisabled);

export default router;

