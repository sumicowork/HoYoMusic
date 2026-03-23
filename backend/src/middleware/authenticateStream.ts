import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  return secret;
};

export const authenticateStream = (req: Request, res: Response, next: NextFunction) => {
  // Try to get token from query parameter (for audio streaming)
  const tokenFromQuery = req.query.token as string;

  // Try to get token from Authorization header (fallback)
  const authHeader = req.headers.authorization;
  const tokenFromHeader = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  const token = tokenFromQuery || tokenFromHeader;

  if (!token) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required'
      }
    });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as any;
    req.user = { id: decoded.id, username: decoded.username };
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token'
      }
    });
  }
};

