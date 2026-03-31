import { Request, Response, NextFunction } from 'express';

interface CacheControlOptions {
  sMaxAge?: number;
  staleWhileRevalidate?: number;
  immutable?: boolean;
}

const applyNoStore = (res: Response) => {
  res.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
};

/**
 * Middleware factory to set Cache-Control headers for public API responses.
 * @param maxAge Cache duration in seconds (0 = no-cache)
 */
export const cacheControl = (maxAge: number, options?: CacheControlOptions) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const hasAuthHeader = Boolean(req.headers.authorization);

    if (hasAuthHeader) {
      // Authenticated clients (admin) should always read fresh data after mutations.
      applyNoStore(res);
      res.set('Vary', 'Authorization');
      return next();
    }

    if (maxAge > 0) {
      const directives = [`public`, `max-age=${maxAge}`];
      if (typeof options?.sMaxAge === 'number' && options.sMaxAge >= 0) {
        directives.push(`s-maxage=${options.sMaxAge}`);
      }
      if (typeof options?.staleWhileRevalidate === 'number' && options.staleWhileRevalidate >= 0) {
        directives.push(`stale-while-revalidate=${options.staleWhileRevalidate}`);
      }
      if (options?.immutable) {
        directives.push('immutable');
      }
      res.set('Cache-Control', directives.join(', '));
    } else {
      applyNoStore(res);
    }
    next();
  };
};

export const noStore = (_req: Request, res: Response, next: NextFunction) => {
  applyNoStore(res);
  next();
};

/** Common cache durations */
export const CACHE_TTL = {
  NONE: 0,
  SHORT: 60,        // 1 minute
  MEDIUM: 300,       // 5 minutes
  LONG: 600,         // 10 minutes
  EXTRA_LONG: 3600,  // 1 hour
} as const;

