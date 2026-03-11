import { Request, Response, NextFunction } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import passport from '../config/passport';
import pool from '../config/database';

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export const login = (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('local', { session: false }, (err: any, user: any, info: any) => {
    if (err) {
      return res.status(500).json({
        success: false,
        error: { code: 'AUTH_ERROR', message: 'Authentication error' }
      });
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: info?.message || 'Invalid credentials' }
      });
    }

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
        },
      },
    });
  })(req, res, next);
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
