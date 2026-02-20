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
  deleteTagGroup
} from '../controllers/tagController';
import { authenticateJWT } from '../middleware/auth';

const router = express.Router();

// ============ Tag Routes ============

// Public routes
router.get('/', getTags);                               // Get all tags
router.get('/:id', getTagById);                         // Get tag by ID with tracks
router.get('/track/:trackId', getTrackTags);            // Get tags for a track

// Protected routes (require authentication)
router.post('/', authenticateJWT, createTag);           // Create new tag
router.put('/:id', authenticateJWT, updateTag);         // Update tag
router.delete('/:id', authenticateJWT, deleteTag);      // Delete tag

// Track-Tag association (require authentication)
router.post('/track/:trackId', authenticateJWT, addTagToTrack);           // Add tag to track
router.delete('/track/:trackId/:tagId', authenticateJWT, removeTagFromTrack);  // Remove tag from track

// ============ Tag Group Routes ============

// Public routes
router.get('/groups/all', getTagGroups);                // Get all tag groups
router.get('/groups/:id', getTagGroupById);             // Get tag group by ID with tags

// Protected routes (require authentication)
router.post('/groups', authenticateJWT, createTagGroup);      // Create new tag group
router.put('/groups/:id', authenticateJWT, updateTagGroup);   // Update tag group
router.delete('/groups/:id', authenticateJWT, deleteTagGroup); // Delete tag group

export default router;

