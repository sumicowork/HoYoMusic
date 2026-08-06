// 评论路由（公开 + 用户 + 管理端）
import { Router } from 'express';
import { authenticateJWT, authenticateAdmin } from '../middleware/auth';
import {
  createComment,
  deleteComment,
  listComments,
  reportComment,
  reviewComment,
  listPendingComments,
  listReports,
  handleReport,
} from '../controllers/commentController';

const router = Router();

// 公开
router.get('/', listComments);

// 用户（需登录）
router.post('/', authenticateJWT, createComment);
router.delete('/:id', authenticateJWT, deleteComment);
router.post('/:id/report', authenticateJWT, reportComment);

// 管理端
router.get('/admin/pending', authenticateAdmin, listPendingComments);
router.post('/admin/:id/review', authenticateAdmin, reviewComment);
router.get('/admin/reports', authenticateAdmin, listReports);
router.post('/admin/reports/:id/handle', authenticateAdmin, handleReport);

export default router;
