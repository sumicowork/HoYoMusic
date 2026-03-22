import { Request, Response, NextFunction } from 'express';
import passport from 'passport';

const authenticateJwtInternal = (
  req: Request,
  res: Response,
  next: NextFunction,
  onSuccess?: (user: any) => boolean
) => {
  passport.authenticate('jwt', { session: false }, (err: any, user: any) => {
    if (err || !user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
    }
    req.user = user;
    if (onSuccess && !onSuccess(user)) {
      return;
    }
    next();
  })(req, res, next);
};

export const authenticateJWT = (req: Request, res: Response, next: NextFunction) => {
  authenticateJwtInternal(req, res, next);
};

export const authenticateAdmin = (req: Request, res: Response, next: NextFunction) => {
  authenticateJwtInternal(req, res, next, (user) => {
    if (!user?.is_admin) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Admin privileges required',
        },
      });
      return false;
    }
    return true;
  });
};

