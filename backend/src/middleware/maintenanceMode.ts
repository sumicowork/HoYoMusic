import { NextFunction, Request, Response } from 'express';
import passport from 'passport';
import pool from '../config/database';

interface MaintenanceModeConfig {
  enabled: boolean;
  expected_end_time: string | null;
  message: string;
  version: string;
}

const DEFAULT_MAINTENANCE: MaintenanceModeConfig = {
  enabled: false,
  expected_end_time: null,
  message: '',
  version: '1',
};

const EXEMPT_PATH_PREFIXES = [
  '/health',
  '/docs',
  '/docs.json',
  '/auth/login',
  '/public/site-config/maintenance',
  '/public/feedback',
  '/public/covers/proxy',
];

const normalizeConfig = (input: unknown): MaintenanceModeConfig => {
  const raw = (input && typeof input === 'object') ? input as Record<string, unknown> : {};
  const expectedEnd = typeof raw.expected_end_time === 'string' && raw.expected_end_time.trim()
    ? raw.expected_end_time.trim()
    : null;
  const message = typeof raw.message === 'string' ? raw.message.trim() : '';

  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : DEFAULT_MAINTENANCE.enabled,
    expected_end_time: expectedEnd,
    message,
    version: typeof raw.version === 'string' && raw.version.trim() ? raw.version.trim() : DEFAULT_MAINTENANCE.version,
  };
};

const readMaintenanceConfig = async (): Promise<MaintenanceModeConfig> => {
  const result = await pool.query(
    'SELECT setting_value FROM app_settings WHERE setting_key = $1 LIMIT 1',
    ['maintenance_mode']
  );

  return result.rows.length > 0
    ? normalizeConfig(result.rows[0].setting_value)
    : DEFAULT_MAINTENANCE;
};

const isExemptPath = (path: string): boolean => EXEMPT_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));

const isAuthenticatedAdmin = (req: Request, res: Response): Promise<boolean> => {
  return new Promise((resolve) => {
    passport.authenticate('jwt', { session: false }, (err: unknown, user: unknown) => {
      const typedUser = user as { is_admin?: boolean } | null;
      if (err || !typedUser || !typedUser.is_admin) {
        resolve(false);
        return;
      }
      req.user = typedUser as any;
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
        message: config.message,
        version: config.version,
      },
    });
  } catch (error) {
    console.error('Maintenance guard failed, allowing request:', error);
    return next();
  }
};

