import { Request, Response, NextFunction } from 'express';

/**
 * Middleware factory to set Cache-Control headers for public API responses.
 * @param maxAge Cache duration in seconds (0 = no-cache)
 */
export const cacheControl = (maxAge: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const hasAuthHeader = Boolean(req.headers.authorization);

    if (hasAuthHeader) {
      // Authenticated clients (admin) should always read fresh data after mutations.
      res.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Vary', 'Authorization');
      return next();
    }

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

