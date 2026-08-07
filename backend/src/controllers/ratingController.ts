// 评分控制器（1-5 星，UNIQUE(target_type,target_id,user_id) 防刷）
import { NextFunction, Request, Response } from 'express';
import pool from '../config/database';

const VALID_TARGETS = ['track', 'album', 'game', 'artist'] as const;
type TargetType = (typeof VALID_TARGETS)[number];

function parseTarget(targetType: unknown, targetId: unknown): { ok: true; type: TargetType; id: number } | { ok: false; message: string } {
  if (!VALID_TARGETS.includes(targetType as TargetType)) return { ok: false, message: 'target_type 无效' };
  const id = Number(targetId);
  if (!Number.isInteger(id) || id <= 0) return { ok: false, message: 'target_id 无效' };
  return { ok: true, type: targetType as TargetType, id };
}

// ── 提交/更新评分 ────────────────────────────────────────
export const upsertRating = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '请先登录' } });

    // 合规：评分属于公开互动信息，与评论一致要求手机号实名（《互联网跟帖评论服务管理规定》）
    const u = await pool.query('SELECT id, phone_verified FROM users WHERE id = $1', [user.id]);
    if (u.rows.length === 0) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '用户不存在' } });
    if (!u.rows[0].phone_verified) {
      return res.status(403).json({ success: false, error: { code: 'PHONE_NOT_VERIFIED', message: '请先绑定手机号完成实名认证' } });
    }

    const { target_type, target_id, score } = req.body as { target_type: string; target_id: number; score: number };
    const t = parseTarget(target_type, target_id);
    if (!t.ok) return res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: t.message } });

    const s = Number(score);
    if (!Number.isInteger(s) || s < 1 || s > 5) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: '评分必须为 1-5 的整数' } });
    }

    // 目标必须存在（防孤儿数据）
    const exists = await pool.query(`SELECT 1 FROM ${t.type}s WHERE id = $1`, [t.id]);
    if (exists.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '目标不存在' } });
    }

    await pool.query(
      `INSERT INTO ratings (target_type, target_id, user_id, score)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (target_type, target_id, user_id)
       DO UPDATE SET score = EXCLUDED.score, updated_at = now()`,
      [t.type, t.id, user.id, s],
    );

    return res.json({ success: true, data: { message: '评分成功' } });
  } catch (e) {
    next(e);
  }
};

// ── 查询评分汇总（均分/人数/分布/我的评分）───────────────
export const getRatingSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const t = parseTarget(req.query.target_type, req.query.target_id);
    if (!t.ok) return res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: t.message } });

    const agg = await pool.query(
      `SELECT count(*)::int AS count, COALESCE(round(avg(score)::numeric, 2), 0)::float AS average
       FROM ratings WHERE target_type = $1 AND target_id = $2`,
      [t.type, t.id],
    );
    const dist = await pool.query(
      `SELECT score, count(*)::int AS n FROM ratings
       WHERE target_type = $1 AND target_id = $2 GROUP BY score ORDER BY score`,
      [t.type, t.id],
    );

    const user = (req as any).user;
    let my_score: number | null = null;
    if (user) {
      const mine = await pool.query(
        `SELECT score FROM ratings WHERE target_type = $1 AND target_id = $2 AND user_id = $3`,
        [t.type, t.id, user.id],
      );
      my_score = mine.rows.length > 0 ? mine.rows[0].score : null;
    }

    const distribution = Object.fromEntries(dist.rows.map((r: any) => [r.score, r.n]));

    return res.json({
      success: true,
      data: {
        count: agg.rows[0].count,
        average: agg.rows[0].average,
        distribution,
        my_score,
      },
    });
  } catch (e) {
    next(e);
  }
};
