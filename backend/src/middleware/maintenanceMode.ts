import { NextFunction, Request, Response } from 'express';
import passport from 'passport';
import pool from '../config/database';

interface MaintenanceModeConfig {
  enabled: boolean;
  expected_end_time: string | null;
  version: string;
}

const DEFAULT_MAINTENANCE: MaintenanceModeConfig = {
  enabled: false,
  expected_end_time: null,
  version: '1',
};

const EXEMPT_PATH_PREFIXES = [
  '/health',
  '/docs',
  '/docs.json',
  '/auth/login',
  '/public/site-config/maintenance',
];

const CACHE_TTL_MS = 5000;
let cachedConfig: MaintenanceModeConfig = DEFAULT_MAINTENANCE;
let cacheExpiresAt = 0;

const normalizeConfig = (input: unknown): MaintenanceModeConfig => {
  const raw = (input && typeof input === 'object') ? input as Record<string, unknown> : {};
  const expectedEnd = typeof raw.expected_end_time === 'string' && raw.expected_end_time.trim()
    ? raw.expected_end_time.trim()
    : null;

  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : DEFAULT_MAINTENANCE.enabled,
    expected_end_time: expectedEnd,
    version: typeof raw.version === 'string' && raw.version.trim() ? raw.version.trim() : DEFAULT_MAINTENANCE.version,
  };
};

const readMaintenanceConfig = async (): Promise<MaintenanceModeConfig> => {
  const now = Date.now();
  if (now < cacheExpiresAt) {
    return cachedConfig;
  }

  const result = await pool.query(
    'SELECT setting_value FROM app_settings WHERE setting_key = $1 LIMIT 1',
    ['maintenance_mode']
  );

  cachedConfig = result.rows.length > 0
    ? normalizeConfig(result.rows[0].setting_value)
    : DEFAULT_MAINTENANCE;
  cacheExpiresAt = now + CACHE_TTL_MS;
  return cachedConfig;
};

const isExemptPath = (path: string): boolean => EXEMPT_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));

const isAuthenticatedAdmin = (req: Request, res: Response): Promise<boolean> => {
  return new Promise((resolve) => {
    passport.authenticate('jwt', { session: false }, (err: unknown, user: unknown) => {
      if (err || !user) {
        resolve(false);
        return;
      }
      req.user = user as any;
      resolve(true);
    })(req, res, () => resolve(false));
  });
};

export const maintenanceModeGuard = async (req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'OPTIONS' || isExemptPath(req.path)) {
    return next();
  }

  try {
    const config = await readMaintenanceConfig();
    if (!config.enabled) {
      return next();
    }

    const allowed = await isAuthenticatedAdmin(req, res);
    if (allowed) {
      return next();
    }

    return res.status(503).json({
      success: false,
      error: {
        code: 'MAINTENANCE_MODE',
        message: 'Site is under maintenance',
      },
      data: {
        enabled: true,
        expected_end_time: config.expected_end_time,
        version: config.version,
      },
    });
  } catch (error) {
    console.error('Maintenance guard failed, allowing request:', error);
    return next();
  }
};

