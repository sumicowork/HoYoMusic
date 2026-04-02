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
router.get('/categories', authenticateAdmin, cacheControl(CACHE_TTL.NONE), getMusicSourceCategories);
router.post('/categories', authenticateAdmin, validateBody(createMusicSourceCategorySchema), createMusicSourceCategory);
router.put('/categories/:id', authenticateAdmin, validateBody(updateMusicSourceCategorySchema), updateMusicSourceCategory);
router.delete('/categories/:id', authenticateAdmin, deleteMusicSourceCategory);

router.get('/nodes', authenticateAdmin, cacheControl(CACHE_TTL.NONE), getMusicSourceNodes);
router.post('/nodes', authenticateAdmin, validateBody(createMusicSourceNodeSchema), createMusicSourceNode);
router.put('/nodes/:id', authenticateAdmin, validateBody(updateMusicSourceNodeSchema), updateMusicSourceNode);
router.delete('/nodes/:id', authenticateAdmin, deleteMusicSourceNode);

// Track relation APIs
router.get('/tracks/:trackId', authenticateAdmin, cacheControl(CACHE_TTL.NONE), getTrackMusicSources);
router.post('/tracks/:trackId', authenticateAdmin, validateBody(upsertTrackMusicSourcesSchema), upsertTrackMusicSources);

// Import / export APIs
router.post('/import/preview', authenticateAdmin, validateBody(musicSourceImportPreviewSchema), previewMusicSourceImport);
router.post('/import/commit', authenticateAdmin, validateBody(musicSourceImportCommitSchema), commitMusicSourceImport);
router.post('/export', authenticateAdmin, validateBody(exportMusicSourcesSchema), exportMusicSources);

export default router;

