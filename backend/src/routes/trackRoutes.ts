import { Router } from 'express';
import { uploadTracks, getTracks, getTrackById, streamTrack, downloadTrack, updateTrack, deleteTrack, uploadTrackCover, bulkDeleteTracks, bulkMoveTracksToAlbum, previewCredits } from '../controllers/trackController';
import { authenticateJWT } from '../middleware/auth';
import { authenticateStream } from '../middleware/authenticateStream';
import upload, { coverUpload } from '../middleware/upload';

const router = Router();

// All track routes require authentication
router.post('/upload', authenticateJWT, upload.array('tracks', 20), uploadTracks);
router.post('/preview-credits', authenticateJWT, upload.array('tracks', 20), previewCredits);
router.delete('/bulk', authenticateJWT, bulkDeleteTracks);
router.post('/bulk-move', authenticateJWT, bulkMoveTracksToAlbum);
router.get('/', authenticateJWT, getTracks);
router.get('/:id', authenticateJWT, getTrackById);
router.put('/:id', authenticateJWT, updateTrack);
router.delete('/:id', authenticateJWT, deleteTrack);
router.post('/:id/cover', authenticateJWT, coverUpload.single('cover'), uploadTrackCover);
router.get('/:id/stream', authenticateStream, streamTrack);
router.get('/:id/download', authenticateStream, downloadTrack);

export default router;

