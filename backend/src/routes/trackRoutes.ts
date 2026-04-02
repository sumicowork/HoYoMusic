import { Router, Request, Response } from 'express';
import { uploadTracks, getTracks, getTrackFilterOptions, getTrackById, streamTrack, downloadTrack, updateTrack, deleteTrack, uploadTrackCover, bulkDeleteTracks, bulkMoveTracksToAlbum, previewCredits, precheckDuplicateTracks, scanSameAlbumDuplicateTracks, previewTrackNotesImport, commitTrackNotesImport, getTrackNotesImportCandidates, exportAllTrackNotes, exportCatalogMetadata, replaceCatalogMetadataByUuid, previewCatalogMetadataByUuid, commitCatalogMetadataByUuid, rollbackCatalogMetadataImportBatch } from '../controllers/trackController';
import { authenticateAdmin } from '../middleware/auth';
import { authenticateStream } from '../middleware/authenticateStream';
import upload, { coverUpload } from '../middleware/upload';
import { validateBody } from '../middleware/validate';
import { updateTrackSchema, bulkDeleteTracksSchema, bulkMoveTracksSchema, previewTrackNotesImportSchema, commitTrackNotesImportSchema, importCatalogMetadataByUuidSchema, previewCatalogMetadataByUuidSchema, commitCatalogMetadataByUuidSchema, rollbackCatalogMetadataBatchSchema } from '../validators/schemas';
import { cacheControl, CACHE_TTL, noStore } from '../middleware/cacheHeaders';

const router = Router();

// ── 全局下载开关（通过环境变量 DOWNLOAD_ENABLED 控制）────────────
const DOWNLOAD_ENABLED = process.env.DOWNLOAD_ENABLED === 'true';
const downloadDisabled = (_req: Request, res: Response) =>
  res.status(503).json({ success: false, error: { code: 'DOWNLOAD_DISABLED', message: '下载功能暂时关闭，服务器维护中。' } });
// ──────────────────────────────────────────────────────────────────

// All track routes require authentication
router.post('/upload', authenticateAdmin, upload.array('tracks', 20), uploadTracks);
router.post('/precheck-duplicates', authenticateAdmin, precheckDuplicateTracks);
router.post('/preview-credits', authenticateAdmin, upload.array('tracks', 20), previewCredits);
router.post('/notes-import/preview', authenticateAdmin, validateBody(previewTrackNotesImportSchema), previewTrackNotesImport);
router.post('/notes-import/commit', authenticateAdmin, validateBody(commitTrackNotesImportSchema), commitTrackNotesImport);
router.get('/notes-import/candidates', authenticateAdmin, cacheControl(CACHE_TTL.NONE), getTrackNotesImportCandidates);
router.get('/notes-export', authenticateAdmin, cacheControl(CACHE_TTL.NONE), exportAllTrackNotes);
router.get('/metadata-export', authenticateAdmin, cacheControl(CACHE_TTL.NONE), exportCatalogMetadata);
router.post('/metadata-import/preview', authenticateAdmin, validateBody(previewCatalogMetadataByUuidSchema), noStore, previewCatalogMetadataByUuid);
router.post('/metadata-import/commit', authenticateAdmin, validateBody(commitCatalogMetadataByUuidSchema), noStore, commitCatalogMetadataByUuid);
router.post('/metadata-import/rollback', authenticateAdmin, validateBody(rollbackCatalogMetadataBatchSchema), noStore, rollbackCatalogMetadataImportBatch);
router.post('/metadata-import/replace-by-uuid', authenticateAdmin, validateBody(importCatalogMetadataByUuidSchema), noStore, replaceCatalogMetadataByUuid);
router.get('/duplicates/same-album-title', authenticateAdmin, cacheControl(CACHE_TTL.NONE), scanSameAlbumDuplicateTracks);
router.delete('/bulk', authenticateAdmin, validateBody(bulkDeleteTracksSchema), bulkDeleteTracks);
router.post('/bulk-move', authenticateAdmin, validateBody(bulkMoveTracksSchema), bulkMoveTracksToAlbum);
router.get('/', authenticateAdmin, cacheControl(CACHE_TTL.NONE), getTracks);
router.get('/filter-options', authenticateAdmin, cacheControl(CACHE_TTL.NONE), getTrackFilterOptions);
router.get('/:id', authenticateAdmin, cacheControl(CACHE_TTL.NONE), getTrackById);
router.put('/:id', authenticateAdmin, validateBody(updateTrackSchema), updateTrack);
router.delete('/:id', authenticateAdmin, deleteTrack);
router.post('/:id/cover', authenticateAdmin, coverUpload.single('cover'), uploadTrackCover);
router.get('/:id/stream', authenticateStream, cacheControl(86400, { immutable: true }), streamTrack);
router.get('/:id/download', authenticateStream, cacheControl(86400, { immutable: true }), DOWNLOAD_ENABLED ? downloadTrack : downloadDisabled);

export default router;

