import { Router } from 'express';
import { getTracks, getTrackById, streamTrack, downloadTrack } from '../controllers/trackController';

const router = Router();

// Public routes - 无需认证
router.get('/tracks', getTracks);
router.get('/tracks/:id', getTrackById);
router.get('/tracks/:id/stream', streamTrack);
router.get('/tracks/:id/download', downloadTrack);

export default router;

