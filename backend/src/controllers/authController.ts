import { Request, Response, NextFunction } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import passport from '../config/passport';
import pool from '../config/database';
import { getMailConfigurationError, sendVerificationCodeEmail } from '../services/emailService';

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

const VERIFICATION_EXPIRES_MINUTES = 10;

const createVerificationCode = (): string => String(Math.floor(100000 + Math.random() * 900000));

export const login = (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('local', { session: false }, (err: any, user: any, info: any) => {
    if (err) {
      return res.status(500).json({
        success: false,
        error: { code: 'AUTH_ERROR', message: 'Authentication error' }
      });
    }

    if (!user) {
      const accountDisabled = info?.code === 'ACCOUNT_DISABLED';
      return res.status(accountDisabled ? 403 : 401).json({
        success: false,
        error: {
          code: accountDisabled ? 'ACCOUNT_DISABLED' : 'INVALID_CREDENTIALS',
          message: info?.message || 'Invalid credentials',
        }
      });
    }

    void pool.query(
      'UPDATE users SET last_login_at = NOW(), last_login_ip = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [req.ip || null, user.id]
    ).catch((error) => {
      console.error('Failed to update login metadata:', error);
    });

    const signOptions: SignOptions = { expiresIn: JWT_EXPIRES_IN as any };
    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      signOptions
    );

    return res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email ?? null,
          email_verified: user.email_verified ?? false,
          is_admin: user.is_admin ?? false,
          account_status: user.account_status ?? 'active',
        },
      },
    });
  })(req, res, next);
};

export const sendRegistrationVerificationCode = async (req: Request, res: Response) => {
  try {
    const configError = getMailConfigurationError();
    if (configError) {
      return res.status(400).json({
        success: false,
        error: { code: 'EMAIL_NOT_CONFIGURED', message: configError },
      });
    }

    const { email } = req.body as { email: string };
    const normalizedEmail = email.trim().toLowerCase();

    const existing = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1', [normalizedEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: { code: 'EMAIL_ALREADY_EXISTS', message: '该邮箱已被注册' },
      });
    }

    const verificationCode = createVerificationCode();
    const codeHash = await bcrypt.hash(verificationCode, 10);
    const expiresAt = new Date(Date.now() + VERIFICATION_EXPIRES_MINUTES * 60 * 1000);

    await pool.query(
      `DELETE FROM auth_verification_codes
       WHERE LOWER(email) = LOWER($1) AND consumed_at IS NULL`,
      [normalizedEmail]
    );

    await pool.query(
      `INSERT INTO auth_verification_codes (email, code_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [normalizedEmail, codeHash, expiresAt.toISOString()]
    );

    await sendVerificationCodeEmail(normalizedEmail, verificationCode);

    return res.json({
      success: true,
      data: { message: '验证码已发送，请查收邮箱' },
    });
  } catch (error) {
    console.error('Send verification code error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'SEND_VERIFICATION_FAILED', message: '发送验证码失败' },
    });
  }
};

export const register = async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const body = req.body as {
      username: string;
      email: string;
      verification_code: string;
      password: string;
      confirm_password: string;
    };

    if (body.password !== body.confirm_password) {
      return res.status(400).json({
        success: false,
        error: { code: 'PASSWORD_MISMATCH', message: '两次输入的密码不一致' },
      });
    }

    const username = body.username.trim();
    const email = body.email.trim().toLowerCase();
    const verificationCode = body.verification_code.trim();

    await client.query('BEGIN');

    const duplicate = await client.query(
      `SELECT username, email
       FROM users
       WHERE username = $1 OR LOWER(email) = LOWER($2)
       LIMIT 1`,
      [username, email]
    );

    if (duplicate.rows.length > 0) {
      await client.query('ROLLBACK');
      const sameUsername = duplicate.rows[0].username === username;
      return res.status(409).json({
        success: false,
        error: {
          code: sameUsername ? 'USERNAME_ALREADY_EXISTS' : 'EMAIL_ALREADY_EXISTS',
          message: sameUsername ? '用户名已存在' : '邮箱已被注册',
        },
      });
    }

    const codeResult = await client.query(
      `SELECT id, code_hash, expires_at
       FROM auth_verification_codes
       WHERE LOWER(email) = LOWER($1) AND consumed_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [email]
    );

    if (codeResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: { code: 'VERIFICATION_CODE_REQUIRED', message: '请先获取邮箱验证码' },
      });
    }

    const codeRow = codeResult.rows[0];
    const expired = new Date(codeRow.expires_at).getTime() < Date.now();
    if (expired) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: { code: 'VERIFICATION_CODE_EXPIRED', message: '验证码已过期，请重新获取' },
      });
    }

    const codeMatched = await bcrypt.compare(verificationCode, String(codeRow.code_hash));
    if (!codeMatched) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: { code: 'VERIFICATION_CODE_INVALID', message: '验证码不正确' },
      });
    }

    const passwordHash = await bcrypt.hash(body.password, 10);
    const userInsert = await client.query(
      `INSERT INTO users (username, email, email_verified, is_admin, account_status, password_hash)
       VALUES ($1, $2, TRUE, FALSE, 'active', $3)
       RETURNING id, username, email, email_verified, is_admin, account_status`,
      [username, email, passwordHash]
    );

    await client.query(
      'UPDATE auth_verification_codes SET consumed_at = NOW() WHERE id = $1',
      [codeRow.id]
    );

    await client.query('COMMIT');

    const user = userInsert.rows[0];
    const signOptions: SignOptions = { expiresIn: JWT_EXPIRES_IN as any };
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, signOptions);

    return res.status(201).json({
      success: true,
      data: {
        token,
        user,
      },
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignore rollback errors when transaction did not start.
    }
    console.error('Register error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'REGISTER_FAILED', message: '注册失败，请稍后重试' },
    });
  } finally {
    client.release();
  }
};

export const getCurrentUser = (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      user: req.user,
    },
  });
};

export const changePassword = async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Current password and new password are required' },
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'New password must be at least 6 characters' },
      });
    }

    // Verify current password
    const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    }

    const isMatch = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: { code: 'WRONG_PASSWORD', message: 'Current password is incorrect' },
      });
    }

    // Hash and update
    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [hash, user.id]);

    res.json({ success: true, data: { message: 'Password changed successfully' } });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to change password' } });
  }
};
