import { Request, Response, NextFunction } from 'express';

/**
 * Middleware factory to set Cache-Control headers for public API responses.
 * @param maxAge Cache duration in seconds (0 = no-cache)
 */
export const cacheControl = (maxAge: number) => {
  return (_req: Request, res: Response, next: NextFunction) => {
    if (maxAge > 0) {
      res.set('Cache-Control', `public, max-age=${maxAge}`);
    } else {
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
    next();
  };
};

/** Common cache durations */
export const CACHE_TTL = {
  NONE: 0,
  SHORT: 60,        // 1 minute
  MEDIUM: 300,       // 5 minutes
  LONG: 600,         // 10 minutes
  EXTRA_LONG: 3600,  // 1 hour
} as const;

