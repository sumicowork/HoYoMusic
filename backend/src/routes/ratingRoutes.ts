// 评分路由
import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { getRatingSummary, upsertRating } from '../controllers/ratingController';

const router = Router();

router.get('/', getRatingSummary); // 公开查询
router.post('/', authenticateJWT, upsertRating); // 登录提交

export default router;
