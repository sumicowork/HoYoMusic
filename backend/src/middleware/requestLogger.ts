import { Request, Response, NextFunction } from 'express';

/**
 * Lightweight request logger that records method, url, status, and response time.
 * Skips health checks and static assets to reduce noise.
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  // Skip noisy endpoints
  if (req.path === '/api/health' || req.path.startsWith('/favicon')) {
    return next();
  }

  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const logLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';

    const msg = `${req.method} ${req.originalUrl} → ${status} (${duration}ms)`;

    if (logLevel === 'error') console.error(`❌ ${msg}`);
    else if (logLevel === 'warn') console.warn(`⚠️  ${msg}`);
    else if (duration > 1000) console.warn(`🐢 SLOW ${msg}`);
    // Normal fast requests: only log in development
    else if (process.env.NODE_ENV !== 'production') console.log(`📝 ${msg}`);
  });

  next();
};

