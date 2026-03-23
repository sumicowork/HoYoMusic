import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import pool from '../config/database';

const USER_STATUS = {
  ACTIVE: 'active',
  DISABLED: 'disabled',
} as const;

const normalizeFilter = (value: unknown): string => String(value || '').trim();

const parseUserId = (req: Request): number | null => {
  const id = Number.parseInt(String(req.params.id || ''), 10);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const countOtherAdmins = async (userIdToExclude: number): Promise<number> => {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM users
     WHERE is_admin = TRUE AND id <> $1 AND account_status = $2`,
    [userIdToExclude, USER_STATUS.ACTIVE]
  );
  return Number(result.rows[0]?.total || 0);
};

const sanitizeStatusReason = (value: unknown): string | null => {
  const reason = typeof value === 'string' ? value.trim() : '';
  return reason ? reason : null;
};

export const listUsers = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
    const pageSizeRaw = Number.parseInt(String(req.query.pageSize || '20'), 10) || 20;
    const pageSize = Math.min(100, Math.max(1, pageSizeRaw));
    const offset = (page - 1) * pageSize;
    const keyword = normalizeFilter(req.query.keyword);
    const role = normalizeFilter(req.query.role);
    const verified = normalizeFilter(req.query.verified);
    const status = normalizeFilter(req.query.status);

    const whereClauses: string[] = [];
    const params: Array<string | number | boolean> = [];

    if (keyword) {
      params.push(`%${keyword}%`);
      whereClauses.push(`(username ILIKE $${params.length} OR COALESCE(email, '') ILIKE $${params.length})`);
    }

    if (role === 'admin') {
      params.push(true);
      whereClauses.push(`is_admin = $${params.length}`);
    } else if (role === 'user') {
      params.push(false);
      whereClauses.push(`is_admin = $${params.length}`);
    }

    if (verified === 'verified') {
      params.push(true);
      whereClauses.push(`email_verified = $${params.length}`);
    } else if (verified === 'unverified') {
      params.push(false);
      whereClauses.push(`email_verified = $${params.length}`);
    }

    if (status === USER_STATUS.ACTIVE || status === USER_STATUS.DISABLED) {
      params.push(status);
      whereClauses.push(`account_status = $${params.length}`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*)::int AS total FROM users ${whereSql}`;
    const listSql = `
      SELECT id, username, email, email_verified, is_admin, account_status, status_reason, last_login_at, last_login_ip, created_at, updated_at
      FROM users
      ${whereSql}
      ORDER BY created_at DESC, id DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const [countResult, listResult] = await Promise.all([
      pool.query(countSql, params),
      pool.query(listSql, [...params, pageSize, offset]),
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

export const updateUserRole = async (req: Request, res: Response) => {
  try {
    const targetUserId = parseUserId(req);
    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid user id' },
      });
    }

    const currentUser = req.user as { id?: number };
    const isAdmin = Boolean((req.body as { is_admin?: boolean }).is_admin);

    if (currentUser?.id === targetUserId && !isAdmin) {
      return res.status(400).json({
        success: false,
        error: { code: 'SELF_ROLE_CHANGE_FORBIDDEN', message: '不能取消自己的管理员权限' },
      });
    }

    const targetResult = await pool.query(
      'SELECT id, username, is_admin, account_status FROM users WHERE id = $1 LIMIT 1',
      [targetUserId]
    );

    if (targetResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    const target = targetResult.rows[0] as { is_admin: boolean; account_status: string };
    if (target.is_admin && !isAdmin) {
      const remainingAdmins = await countOtherAdmins(targetUserId);
      if (remainingAdmins === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'LAST_ADMIN_PROTECTED', message: '至少需要保留一名可用管理员' },
        });
      }
    }

    const result = await pool.query(
      `UPDATE users
       SET is_admin = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, username, email, email_verified, is_admin, account_status, status_reason, last_login_at, last_login_ip, created_at, updated_at`,
      [isAdmin, targetUserId]
    );

    return res.json({ success: true, data: { user: result.rows[0] } });
  } catch (error) {
    console.error('Failed to update user role:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'USER_ROLE_UPDATE_ERROR', message: 'Failed to update user role' },
    });
  }
};

export const updateUserStatus = async (req: Request, res: Response) => {
  try {
    const targetUserId = parseUserId(req);
    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid user id' },
      });
    }

    const currentUser = req.user as { id?: number };
    const payload = req.body as { account_status: 'active' | 'disabled'; status_reason?: string | null };

    if (currentUser?.id === targetUserId && payload.account_status === USER_STATUS.DISABLED) {
      return res.status(400).json({
        success: false,
        error: { code: 'SELF_STATUS_CHANGE_FORBIDDEN', message: '不能停用自己的账号' },
      });
    }

    const targetResult = await pool.query(
      'SELECT id, username, is_admin FROM users WHERE id = $1 LIMIT 1',
      [targetUserId]
    );

    if (targetResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    if (payload.account_status === USER_STATUS.DISABLED && targetResult.rows[0].is_admin) {
      const remainingAdmins = await countOtherAdmins(targetUserId);
      if (remainingAdmins === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'LAST_ADMIN_PROTECTED', message: '至少需要保留一名可用管理员' },
        });
      }
    }

    const statusReason = payload.account_status === USER_STATUS.DISABLED
      ? sanitizeStatusReason(payload.status_reason)
      : null;

    const result = await pool.query(
      `UPDATE users
       SET account_status = $1,
           status_reason = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id, username, email, email_verified, is_admin, account_status, status_reason, last_login_at, last_login_ip, created_at, updated_at`,
      [payload.account_status, statusReason, targetUserId]
    );

    return res.json({ success: true, data: { user: result.rows[0] } });
  } catch (error) {
    console.error('Failed to update user status:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'USER_STATUS_UPDATE_ERROR', message: 'Failed to update user status' },
    });
  }
};

export const updateUserEmailVerification = async (req: Request, res: Response) => {
  try {
    const targetUserId = parseUserId(req);
    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid user id' },
      });
    }

    const emailVerified = Boolean((req.body as { email_verified?: boolean }).email_verified);
    const result = await pool.query(
      `UPDATE users
       SET email_verified = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, username, email, email_verified, is_admin, account_status, status_reason, last_login_at, last_login_ip, created_at, updated_at`,
      [emailVerified, targetUserId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    return res.json({ success: true, data: { user: result.rows[0] } });
  } catch (error) {
    console.error('Failed to update email verification:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'USER_EMAIL_VERIFY_UPDATE_ERROR', message: 'Failed to update email verification' },
    });
  }
};

export const resetUserPassword = async (req: Request, res: Response) => {
  try {
    const targetUserId = parseUserId(req);
    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid user id' },
      });
    }

    const { new_password: newPassword } = req.body as { new_password: string };
    const passwordHash = await bcrypt.hash(newPassword, 10);

    const result = await pool.query(
      `UPDATE users
       SET password_hash = $1,
           token_version = token_version + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, username, email, email_verified, is_admin, account_status, status_reason, last_login_at, last_login_ip, created_at, updated_at`,
      [passwordHash, targetUserId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      });
    }

    return res.json({
      success: true,
      data: {
        user: result.rows[0],
        message: 'Password reset successfully',
      },
    });
  } catch (error) {
    console.error('Failed to reset user password:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'USER_PASSWORD_RESET_ERROR', message: 'Failed to reset user password' },
    });
  }
};

