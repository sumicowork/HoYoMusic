import { Request, Response } from 'express';
import pool from '../config/database';

export const listUsers = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
    const pageSizeRaw = Number.parseInt(String(req.query.pageSize || '20'), 10) || 20;
    const pageSize = Math.min(100, Math.max(1, pageSizeRaw));
    const offset = (page - 1) * pageSize;

    const [countResult, listResult] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS total FROM users'),
      pool.query(
        `SELECT id, username, email, email_verified, is_admin, created_at, updated_at
         FROM users
         ORDER BY created_at DESC, id DESC
         LIMIT $1 OFFSET $2`,
        [pageSize, offset]
      ),
    ]);

    const total = Number(countResult.rows[0]?.total || 0);

    return res.json({
      success: true,
      data: {
        items: listResult.rows,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
        },
      },
    });
  } catch (error) {
    console.error('Failed to list users:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'USERS_LIST_ERROR', message: 'Failed to load users' },
    });
  }
};

