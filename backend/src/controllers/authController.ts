import { Request, Response, NextFunction } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { randomInt, randomUUID } from 'crypto';
import passport from '../config/passport';
import pool from '../config/database';
import { getMailConfigurationError, sendVerificationCodeEmail } from '../services/emailService';
import { sendSmsCode } from '../services/smsService';

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

const VERIFICATION_EXPIRES_MINUTES = 10;
const VERIFICATION_MAX_ATTEMPTS = Math.max(3, parseInt(process.env.VERIFICATION_MAX_ATTEMPTS || '5', 10));
const VERIFICATION_LOCK_MINUTES = Math.max(1, parseInt(process.env.VERIFICATION_LOCK_MINUTES || '10', 10));

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return secret;
};

const createVerificationCode = (): string => String(randomInt(0, 1000000)).padStart(6, '0');

// 手机号维度短信限流（防短信轰炸/控费）：60 秒间隔 + 每自然日（UTC+8）上限
const SMS_MIN_INTERVAL_MS = 60 * 1000;
const SMS_DAILY_LIMIT = 10;

async function checkSmsThrottle(phone: string): Promise<{ ok: boolean; message?: string; code?: string }> {
  const recent = await pool.query(
    `SELECT 1 FROM sms_send_log WHERE phone = $1 AND created_at > now() - interval '60 seconds' LIMIT 1`,
    [phone],
  );
  if (recent.rows.length > 0) {
    return { ok: false, code: 'SMS_TOO_FREQUENT', message: '发送过于频繁，请 60 秒后再试' };
  }

  const daily = await pool.query(
    `SELECT count(*)::int AS c FROM sms_send_log
     WHERE phone = $1 AND created_at > (now() AT TIME ZONE 'Asia/Shanghai')::date::timestamptz`,
    [phone],
  );
  if (daily.rows[0].c >= SMS_DAILY_LIMIT) {
    return { ok: false, code: 'SMS_DAILY_LIMIT', message: '该手机号今日短信发送次数已达上限' };
  }

  return { ok: true };
}

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
      { id: user.id, username: user.username, token_version: Number(user.token_version ?? 0) },
      getJwtSecret(),
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
      return res.json({
        success: true,
        data: { message: '如果邮箱可用，验证码将发送到该邮箱' },
      });
    }

    const verificationCode = createVerificationCode();
    const verificationChallengeId = randomUUID();
    const codeHash = await bcrypt.hash(verificationCode, 10);
    const expiresAt = new Date(Date.now() + VERIFICATION_EXPIRES_MINUTES * 60 * 1000);

    await pool.query(
      `DELETE FROM auth_verification_codes
       WHERE LOWER(email) = LOWER($1) AND consumed_at IS NULL`,
      [normalizedEmail]
    );

    await pool.query(
      `INSERT INTO auth_verification_codes (email, challenge_id, code_hash, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [normalizedEmail, verificationChallengeId, codeHash, expiresAt.toISOString()]
    );

    await sendVerificationCodeEmail(normalizedEmail, verificationCode);

    return res.json({
      success: true,
      data: {
        message: '如果邮箱可用，验证码将发送到该邮箱',
        verification_challenge_id: verificationChallengeId,
      },
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
      verification_challenge_id: string;
      verification_code: string;
      password: string;
      confirm_password: string;
      accept_terms?: boolean;
    };

    // 合规：《互联网跟帖评论服务管理规定》第5条① 须与注册用户签订服务协议
    if (body.accept_terms !== true) {
      return res.status(400).json({
        success: false,
        error: { code: 'TERMS_NOT_ACCEPTED', message: '请先阅读并同意《用户协议》和《隐私政策》' },
      });
    }

    if (body.password !== body.confirm_password) {
      return res.status(400).json({
        success: false,
        error: { code: 'PASSWORD_MISMATCH', message: '两次输入的密码不一致' },
      });
    }

    const username = body.username.trim();
    const email = body.email.trim().toLowerCase();
    const verificationChallengeId = body.verification_challenge_id.trim();
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
      `SELECT id, code_hash, expires_at, attempt_count, locked_until
       FROM auth_verification_codes
       WHERE LOWER(email) = LOWER($1)
         AND challenge_id = $2
         AND consumed_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [email, verificationChallengeId]
    );

    if (codeResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: { code: 'VERIFICATION_CHALLENGE_INVALID', message: '验证码会话无效，请重新获取验证码' },
      });
    }

    const codeRow = codeResult.rows[0];
    if (codeRow.locked_until && new Date(codeRow.locked_until).getTime() > Date.now()) {
      await client.query('ROLLBACK');
      return res.status(429).json({
        success: false,
        error: { code: 'VERIFICATION_CODE_LOCKED', message: '验证码尝试次数过多，请稍后再试' },
      });
    }

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
      const nextAttemptCount = Number(codeRow.attempt_count || 0) + 1;
      const lockUntil = nextAttemptCount >= VERIFICATION_MAX_ATTEMPTS
        ? new Date(Date.now() + VERIFICATION_LOCK_MINUTES * 60 * 1000).toISOString()
        : null;
      await client.query(
        `UPDATE auth_verification_codes
         SET attempt_count = $1,
             locked_until = COALESCE($2::timestamptz, locked_until)
         WHERE id = $3`,
        [nextAttemptCount, lockUntil, codeRow.id]
      );
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: { code: 'VERIFICATION_CODE_INVALID', message: '验证码不正确' },
      });
    }

    const passwordHash = await bcrypt.hash(body.password, 10);
    const userInsert = await client.query(
      `INSERT INTO users (username, email, email_verified, is_admin, account_status, password_hash, accept_terms_at)
       VALUES ($1, $2, TRUE, FALSE, 'active', $3, NOW())
       RETURNING id, username, email, email_verified, is_admin, account_status`,
      [username, email, passwordHash]
    );

    await client.query(
      'UPDATE auth_verification_codes SET consumed_at = NOW(), attempt_count = 0, locked_until = NULL WHERE id = $1',
      [codeRow.id]
    );

    await client.query('COMMIT');

    const user = userInsert.rows[0];
    const signOptions: SignOptions = { expiresIn: JWT_EXPIRES_IN as any };
    const token = jwt.sign(
      { id: user.id, username: user.username, token_version: Number(user.token_version ?? 0) },
      getJwtSecret(),
      signOptions
    );

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

// ── 手机号实名：发送验证码 ─────────────────────────────
// 合规：《互联网跟帖评论服务管理规定》第4条① 基于移动电话号码的真实身份信息认证
export const sendPhoneCode = async (req: Request, res: Response) => {
  try {
    const { phone } = req.body as { phone: string };
    const normalized = String(phone || '').trim();
    if (!/^1[3-9]\d{9}$/.test(normalized)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_PHONE', message: '手机号格式不正确' } });
    }

    // 手机号维度限流（60s 间隔 + 每日上限）
    const throttle = await checkSmsThrottle(normalized);
    if (!throttle.ok) {
      return res.status(429).json({ success: false, error: { code: throttle.code, message: throttle.message } });
    }

    const code = createVerificationCode();
    const challengeId = randomUUID();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + VERIFICATION_EXPIRES_MINUTES * 60 * 1000);

    await pool.query(
      `DELETE FROM auth_verification_codes WHERE phone = $1 AND consumed_at IS NULL`,
      [normalized],
    );
    await pool.query(
      `INSERT INTO auth_verification_codes (phone, challenge_id, code_hash, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [normalized, challengeId, codeHash, expiresAt.toISOString()],
    );

    const result = await sendSmsCode(normalized, code);
    if (!result.success) {
      return res.status(500).json({ success: false, error: { code: 'SMS_SEND_FAILED', message: result.message } });
    }

    // 发送成功才记日志（限流依据 + 审计留存）
    await pool.query(`INSERT INTO sms_send_log (phone, purpose) VALUES ($1, 'phone_bind')`, [normalized]);

    return res.json({
      success: true,
      data: { message: '验证码已发送', verification_challenge_id: challengeId },
    });
  } catch (error) {
    console.error('Send phone code error:', error);
    return res.status(500).json({ success: false, error: { code: 'SEND_FAILED', message: '发送验证码失败' } });
  }
};

// ── 手机号实名：验证并绑定到当前用户 ───────────────────
export const bindPhone = async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user?.id) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '请先登录' } });

    const { phone, code } = req.body as { phone: string; code: string };
    const normalized = String(phone || '').trim();
    if (!/^1[3-9]\d{9}$/.test(normalized)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_PHONE', message: '手机号格式不正确' } });
    }

    // 手机号是否已被他人绑定
    const taken = await pool.query(
      `SELECT id FROM users WHERE phone = $1 AND id <> $2 AND phone_verified`,
      [normalized, user.id],
    );
    if (taken.rows.length > 0) {
      return res.status(409).json({ success: false, error: { code: 'PHONE_TAKEN', message: '该手机号已绑定其他账号' } });
    }

    const record = await pool.query(
      `SELECT id, code_hash, expires_at, attempt_count, locked_until
       FROM auth_verification_codes
       WHERE phone = $1 AND consumed_at IS NULL
       ORDER BY created_at DESC LIMIT 1`,
      [normalized],
    );
    if (record.rows.length === 0) {
      return res.status(400).json({ success: false, error: { code: 'NO_CODE', message: '请先发送验证码' } });
    }

    const row = record.rows[0];
    if (row.locked_until && new Date(row.locked_until) > new Date()) {
      return res.status(429).json({ success: false, error: { code: 'TOO_MANY_ATTEMPTS', message: '尝试次数过多，请稍后再试' } });
    }
    if (new Date(row.expires_at) < new Date()) {
      return res.status(400).json({ success: false, error: { code: 'CODE_EXPIRED', message: '验证码已过期' } });
    }

    const ok = await bcrypt.compare(String(code || '').trim(), row.code_hash);
    if (!ok) {
      const attempts = row.attempt_count + 1;
      const lock = attempts >= VERIFICATION_MAX_ATTEMPTS ? new Date(Date.now() + VERIFICATION_LOCK_MINUTES * 60 * 1000) : null;
      await pool.query(
        `UPDATE auth_verification_codes SET attempt_count = $1, locked_until = $2 WHERE id = $3`,
        [attempts, lock, row.id],
      );
      return res.status(400).json({ success: false, error: { code: 'INVALID_CODE', message: '验证码错误' } });
    }

    await pool.query(
      `UPDATE auth_verification_codes SET consumed_at = now() WHERE id = $1`,
      [row.id],
    );
    await pool.query(
      `UPDATE users SET phone = $1, phone_verified = true WHERE id = $2`,
      [normalized, user.id],
    );

    return res.json({ success: true, data: { message: '手机号绑定成功，已完成实名认证' } });
  } catch (error) {
    console.error('Bind phone error:', error);
    return res.status(500).json({ success: false, error: { code: 'BIND_FAILED', message: '绑定失败' } });
  }
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
    await pool.query(
      `UPDATE users
       SET password_hash = $1,
           token_version = token_version + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [hash, user.id]
    );

    res.json({ success: true, data: { message: 'Password changed successfully' } });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Failed to change password' } });
  }
};
