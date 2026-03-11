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
import { authenticateJWT } from '../middleware/auth';
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
router.get('/', cacheControl(CACHE_TTL.SHORT), getTags);
router.get('/:id', cacheControl(CACHE_TTL.SHORT), getTagById);
router.get('/track/:trackId', getTrackTags);

// Protected routes (require authentication)
router.post('/', authenticateJWT, validateBody(createTagSchema), createTag);
router.put('/:id', authenticateJWT, validateBody(updateTagSchema), updateTag);
router.delete('/:id', authenticateJWT, deleteTag);
router.post('/bulk-update', authenticateJWT, validateBody(bulkUpdateTrackTagsSchema), bulkUpdateTrackTags);

// Track-Tag association (require authentication)
router.post('/track/:trackId', authenticateJWT, validateBody(addTagToTrackSchema), addTagToTrack);
router.delete('/track/:trackId/:tagId', authenticateJWT, removeTagFromTrack);

// ============ Tag Group Routes ============

// Public routes
router.get('/groups/all', getTagGroups);
router.get('/groups/:id', getTagGroupById);

// Protected routes (require authentication)
router.post('/groups', authenticateJWT, validateBody(createTagGroupSchema), createTagGroup);
router.put('/groups/:id', authenticateJWT, validateBody(updateTagGroupSchema), updateTagGroup);
router.delete('/groups/:id', authenticateJWT, deleteTagGroup);

export default router;

