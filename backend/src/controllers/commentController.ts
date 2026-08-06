// 评论控制器（合规：《互联网跟帖评论服务管理规定》2022）
// - 发布：需登录 + 手机号实名；规则审核（敏感词→rejected，可疑→pending 人工，正常→approved）
// - 列表：approved + 自己的 pending/rejected；软删不物理删（日志留存 ≥6 个月）
// - 删除：作者本人或管理员（软删）
// - 举报：任何登录用户
import { NextFunction, Request, Response } from 'express';
import pool from '../config/database';
import { moderateComment } from '../services/moderationService';

const VALID_TARGETS = ['track', 'album', 'game', 'artist'] as const;
type TargetType = (typeof VALID_TARGETS)[number];

interface AuthedUser {
  id: number;
  username: string;
  is_admin?: boolean;
}

function getUser(req: Request): AuthedUser | null {
  return (req as any).user ?? null;
}

function parseTarget(targetType: unknown, targetId: unknown): { ok: true; type: TargetType; id: number } | { ok: false; message: string } {
  if (!VALID_TARGETS.includes(targetType as TargetType)) return { ok: false, message: 'target_type 无效' };
  const id = Number(targetId);
  if (!Number.isInteger(id) || id <= 0) return { ok: false, message: 'target_id 无效' };
  return { ok: true, type: targetType as TargetType, id };
}

// ── 创建评论 ─────────────────────────────────────────────
export const createComment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    if (!user) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '请先登录' } });

    // 实名门槛
    const u = await pool.query('SELECT id, phone, phone_verified FROM users WHERE id = $1', [user.id]);
    if (u.rows.length === 0) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '用户不存在' } });
    if (!u.rows[0].phone_verified) {
      return res.status(403).json({ success: false, error: { code: 'PHONE_NOT_VERIFIED', message: '请先绑定手机号完成实名认证' } });
    }

    const { target_type, target_id, content } = req.body as { target_type: string; target_id: number; content: string };
    const t = parseTarget(target_type, target_id);
    if (!t.ok) return res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: t.message } });

    const text = String(content ?? '').trim();
    const mod = moderateComment(text);
    if (mod.status === 'rejected') {
      return res.status(400).json({ success: false, error: { code: 'CONTENT_REJECTED', message: mod.reason || '内容不合规' } });
    }

    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || null;
    const ua = (req.headers['user-agent'] as string)?.slice(0, 500) || null;

    const r = await pool.query(
      `INSERT INTO comments (target_type, target_id, user_id, content, status, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, content, status, created_at`,
      [t.type, t.id, user.id, text, mod.status, ip, ua],
    );
    const row = r.rows[0];

    return res.status(201).json({
      success: true,
      data: {
        comment: {
          id: row.id,
          content: row.content,
          status: row.status,
          created_at: row.created_at,
          message: mod.status === 'pending' ? '评论已提交，等待审核' : '评论已发布',
        },
      },
    });
  } catch (e) {
    next(e);
  }
};

// ── 评论列表（分页）─────────────────────────────────────
export const listComments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const t = parseTarget(req.query.target_type, req.query.target_id);
    if (!t.ok) return res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: t.message } });

    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(req.query.page_size) || 20));
    const offset = (page - 1) * pageSize;
    const user = getUser(req);

    const params: any[] = [t.type, t.id];
    let userCond = '';
    if (user) {
      params.push(user.id);
      userCond = `OR (c.user_id = $${params.length} AND c.status IN ('pending', 'rejected'))`;
    }

    const list = await pool.query(
      `SELECT c.id, c.content, c.status, c.created_at, c.report_count,
              u.username, u.id AS user_id
       FROM comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.target_type = $1 AND c.target_id = $2
         AND c.deleted_at IS NULL
         AND (c.status = 'approved' ${userCond})
       ORDER BY c.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, offset],
    );

    const total = await pool.query(
      `SELECT count(*)::int AS c FROM comments
       WHERE target_type = $1 AND target_id = $2 AND deleted_at IS NULL AND status = 'approved'`,
      [t.type, t.id],
    );

    return res.json({
      success: true,
      data: {
        comments: list.rows.map((r: any) => ({
          id: r.id,
          content: r.content,
          status: r.status,
          created_at: r.created_at,
          report_count: r.report_count,
          user: { id: r.user_id, username: r.username },
        })),
        total: total.rows[0].c,
        page,
        page_size: pageSize,
      },
    });
  } catch (e) {
    next(e);
  }
};

// ── 删除评论（作者/管理员，软删）────────────────────────
export const deleteComment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    if (!user) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '请先登录' } });

    const id = Number(req.params.id);
    const r = await pool.query('SELECT id, user_id FROM comments WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (r.rows.length === 0) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '评论不存在' } });

    if (r.rows[0].user_id !== user.id && !user.is_admin) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: '无权删除' } });
    }

    await pool.query(`UPDATE comments SET deleted_at = now() WHERE id = $1`, [id]);
    return res.json({ success: true, data: { message: '已删除' } });
  } catch (e) {
    next(e);
  }
};

// ── 举报评论 ────────────────────────────────────────────
export const reportComment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = getUser(req);
    if (!user) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '请先登录' } });

    const id = Number(req.params.id);
    const { reason, detail } = req.body as { reason?: string; detail?: string };

    const r = await pool.query('SELECT id FROM comments WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (r.rows.length === 0) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '评论不存在' } });

    const dup = await pool.query(
      `SELECT id FROM reports WHERE comment_id = $1 AND reporter_id = $2 AND status = 'pending'`,
      [id, user.id],
    );
    if (dup.rows.length > 0) {
      return res.status(400).json({ success: false, error: { code: 'ALREADY_REPORTED', message: '您已举报过该评论' } });
    }

    await pool.query(
      `INSERT INTO reports (comment_id, reporter_id, reason, detail) VALUES ($1, $2, $3, $4)`,
      [id, user.id, String(reason || '其他').slice(0, 100), String(detail || '').slice(0, 500)],
    );
    await pool.query(`UPDATE comments SET report_count = report_count + 1 WHERE id = $1`, [id]);

    return res.status(201).json({ success: true, data: { message: '举报已受理' } });
  } catch (e) {
    next(e);
  }
};

// ── 管理端：审核队列 ────────────────────────────────────
export const listPendingComments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = String(req.query.status || 'pending');
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(req.query.page_size) || 20));
    const offset = (page - 1) * pageSize;

    const list = await pool.query(
      `SELECT c.id, c.target_type, c.target_id, c.content, c.status, c.created_at, c.ip, c.report_count,
              u.username, u.id AS user_id
       FROM comments c JOIN users u ON u.id = c.user_id
       WHERE c.deleted_at IS NULL AND c.status = $1
       ORDER BY c.created_at ASC
       LIMIT $2 OFFSET $3`,
      [status, pageSize, offset],
    );
    const total = await pool.query(
      `SELECT count(*)::int AS c FROM comments WHERE deleted_at IS NULL AND status = $1`,
      [status],
    );

    return res.json({
      success: true,
      data: { comments: list.rows, total: total.rows[0].c, page, page_size: pageSize },
    });
  } catch (e) {
    next(e);
  }
};

// ── 管理端：审核（approve/reject）───────────────────────
export const reviewComment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const { action } = req.body as { action?: string };
    if (action !== 'approve' && action !== 'reject') {
      return res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'action 必须为 approve 或 reject' } });
    }

    const r = await pool.query(
      `UPDATE comments SET status = $1, updated_at = now() WHERE id = $2 AND deleted_at IS NULL RETURNING id, status`,
      [action === 'approve' ? 'approved' : 'rejected', id],
    );
    if (r.rows.length === 0) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '评论不存在' } });

    return res.json({ success: true, data: { comment: r.rows[0] } });
  } catch (e) {
    next(e);
  }
};

// ── 管理端：举报列表 + 处理 ──────────────────────────────
export const listReports = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(req.query.page_size) || 20));
    const offset = (page - 1) * pageSize;

    const list = await pool.query(
      `SELECT r.id, r.reason, r.detail, r.status, r.created_at,
              c.id AS comment_id, c.content AS comment_content, c.status AS comment_status,
              cu.username AS comment_author, rp.username AS reporter
       FROM reports r
       JOIN comments c ON c.id = r.comment_id
       JOIN users cu ON cu.id = c.user_id
       JOIN users rp ON rp.id = r.reporter_id
       WHERE r.status = 'pending'
       ORDER BY r.created_at ASC
       LIMIT $1 OFFSET $2`,
      [pageSize, offset],
    );
    const total = await pool.query(`SELECT count(*)::int AS c FROM reports WHERE status = 'pending'`);

    return res.json({ success: true, data: { reports: list.rows, total: total.rows[0].c, page, page_size: pageSize } });
  } catch (e) {
    next(e);
  }
};

export const handleReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const user = getUser(req);
    const { action, delete_comment } = req.body as { action?: string; delete_comment?: boolean };

    const r = await pool.query(
      `UPDATE reports SET status = 'handled', handled_at = now(), handler_id = $1 WHERE id = $2 AND status = 'pending' RETURNING id`,
      [user?.id, id],
    );
    if (r.rows.length === 0) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '举报不存在或已处理' } });

    if (delete_comment) {
      await pool.query(`UPDATE comments SET deleted_at = now() WHERE id = (SELECT comment_id FROM reports WHERE id = $1)`, [id]);
    }

    return res.json({ success: true, data: { message: '已处理' } });
  } catch (e) {
    next(e);
  }
};
