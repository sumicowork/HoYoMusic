import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import pool from '../config/database';

type VisitLogEntry = [
  string,
  string | null,
  string | null,
  string | null,
  string | null,
  number | null,
  number | null,
  string,
  string,
  number,
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  number | null,
  string | null,
];

// Lazily load geoip-lite and ua-parser-js so startup isn't blocked
let geoip: any = null;
let UAParser: any = null;
try { geoip = require('geoip-lite'); } catch { /* optional */ }
try { UAParser = require('ua-parser-js'); } catch { /* optional */ }

// Skip recording for these path prefixes / patterns
const SKIP_PREFIXES = ['/uploads/', '/api/public/covers/proxy', '/api/public/site-config/maintenance'];
const VISITOR_COOKIE_KEY = 'visitor_id';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SKIP_PATTERNS = [/\/stream(\?|$)/, /\.(woff2?|ttf|ico|svg|map)(\?|$)/i];
const VISIT_LOGGER_ENABLED = process.env.VISIT_LOGGER_ENABLED !== 'false';
const FLUSH_INTERVAL_MS = Math.max(200, parseInt(process.env.VISIT_LOGGER_FLUSH_MS || '1000', 10));
const BATCH_SIZE = Math.max(10, parseInt(process.env.VISIT_LOGGER_BATCH_SIZE || '30', 10));
const MAX_QUEUE_SIZE = Math.max(BATCH_SIZE, parseInt(process.env.VISIT_LOGGER_MAX_QUEUE || '5000', 10));

const queue: VisitLogEntry[] = [];
let flushing = false;
const visitorMergeCache = new Set<string>();

function sanitizeVisitorId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (!value) return null;
  if (value.length > 128) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  return value;
}

function parseCookieValue(req: Request, key: string): string | null {
  const raw = req.headers.cookie;
  if (!raw) return null;

  const entries = raw.split(';');
  for (const entry of entries) {
    const [k, ...v] = entry.trim().split('=');
    if (k !== key) continue;
    try {
      return decodeURIComponent(v.join('='));
    } catch {
      return v.join('=');
    }
  }
  return null;
}

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function getVisitorId(req: Request): string | null {
  const headerRaw = sanitizeVisitorId(req.headers['x-visitor-id']);
  if (headerRaw && isUuid(headerRaw)) {
    return headerRaw;
  }

  const cookieRaw = sanitizeVisitorId(parseCookieValue(req, VISITOR_COOKIE_KEY));
  if (cookieRaw && isUuid(cookieRaw)) {
    return cookieRaw;
  }

  return null;
}

function getAuthIdentity(req: Request): { userId: number | null; username: string | null } {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { userId: null, username: null };
  }

  const token = authHeader.slice(7).trim();
  if (!token) return { userId: null, username: null };

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    // Keep logging non-blocking and avoid implicit fallback secrets.
    return { userId: null, username: null };
  }

  try {
    const payload = jwt.verify(token, jwtSecret) as { id?: unknown; userId?: unknown; username?: unknown };
    const username = typeof payload.username === 'string' && payload.username.trim()
      ? payload.username.trim().slice(0, 128)
      : null;
    const idRaw = payload.id ?? payload.userId;
    const userId = Number.isFinite(Number(idRaw)) ? Number(idRaw) : null;
    return { userId, username };
  } catch {
    // Ignore invalid token for logging enrichment; auth middleware handles authorization.
  }
  return { userId: null, username: null };
}

function mergeVisitorLogs(fromVisitorId: string, toVisitorId: string): void {
  if (!fromVisitorId || !toVisitorId || fromVisitorId === toVisitorId) return;
  const cacheKey = `${fromVisitorId}->${toVisitorId}`;
  if (visitorMergeCache.has(cacheKey)) return;
  visitorMergeCache.add(cacheKey);

  pool.query(
    `UPDATE visit_logs
     SET visitor_id = $2
     WHERE visitor_id = $1`,
    [fromVisitorId, toVisitorId]
  ).catch((err) => {
    visitorMergeCache.delete(cacheKey);
    console.warn('[visitLogger:mergeVisitorLogs]', (err as Error).message || 'unknown error');
  });
}

function ensureVisitorId(req: Request, res: Response): string {
  const existing = getVisitorId(req);
  if (existing) return existing;

  const generated = randomUUID();
  const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  res.cookie(VISITOR_COOKIE_KEY, generated, {
    httpOnly: false,
    sameSite: 'lax',
    secure,
    maxAge: 1000 * 60 * 60 * 24 * 365,
    path: '/',
  });
  return generated;
}

function getRealIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim();
  }

  const socketIp = req.socket.remoteAddress || req.ip;
  if (socketIp) {
    return socketIp;
  }

  return '0.0.0.0';
}

async function flushQueue(force = false): Promise<void> {
  if (flushing || queue.length === 0) return;
  if (!force && queue.length < BATCH_SIZE) return;

  flushing = true;
  const batch = queue.splice(0, Math.min(queue.length, BATCH_SIZE));

  try {
    const placeholders = batch.map((_, i) => {
      const base = i * 19;
      return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9},$${base + 10},$${base + 11},$${base + 12},$${base + 13},$${base + 14},$${base + 15},$${base + 16},$${base + 17},$${base + 18},$${base + 19})`;
    }).join(',');
    const values = batch.flat();

    await pool.query(
      `INSERT INTO visit_logs
        (ip, visitor_id, country, region, city, latitude, longitude,
         method, path, status, duration_ms,
         user_agent, ua_browser, ua_os, ua_device,
         referer, bytes_sent, actor_user_id, actor_username)
       VALUES ${placeholders}`,
      values
    );
  } catch (err) {
    const message = (err as Error).message || 'unknown error';
    if (!message.includes('visit_logs')) {
      console.warn('[visitLogger:flush]', message);
    }
  } finally {
    flushing = false;
    if (queue.length >= BATCH_SIZE) {
      setImmediate(() => { void flushQueue(true); });
    }
  }
}

setInterval(() => {
  void flushQueue(true);
}, FLUSH_INTERVAL_MS).unref();

function enqueue(entry: VisitLogEntry): void {
  if (queue.length >= MAX_QUEUE_SIZE) {
    queue.shift();
  }
  queue.push(entry);
  if (queue.length >= BATCH_SIZE) {
    void flushQueue(true);
  }
}

export function visitLogger(req: Request, res: Response, next: NextFunction) {
  if (!VISIT_LOGGER_ENABLED) return next();

  ensureVisitorId(req, res);
  const urlPath = req.path;
  if (SKIP_PREFIXES.some(p => urlPath.startsWith(p))) return next();
  if (SKIP_PATTERNS.some(p => p.test(urlPath))) return next();

  const startAt = Date.now();
  res.on('finish', () => {
    try {
      const duration = Date.now() - startAt;
      const ip = getRealIp(req);
      const rawVisitorId = getVisitorId(req);
      const authIdentity = getAuthIdentity(req);
      const authUsername = authIdentity.username;
      const visitorId = authUsername || rawVisitorId;

      if (authUsername && rawVisitorId && rawVisitorId !== authUsername) {
        // Merge historical anonymous visitor rows into the authenticated username bucket.
        mergeVisitorLogs(rawVisitorId, authUsername);
      }
      const ua = (req.headers['user-agent'] || '').slice(0, 512);
      const referer = ((req.headers['referer'] || req.headers['referrer'] || '') as string).slice(0, 512);

      // Geo
      let country: string | null = null, region: string | null = null,
          city: string | null = null, lat: number | null = null, lon: number | null = null;
      if (geoip && ip !== '127.0.0.1' && ip !== '0.0.0.0' && !ip.startsWith('192.168') && !ip.startsWith('10.')) {
        const geo = geoip.lookup(ip);
        if (geo) {
          country = geo.country || null;
          region  = geo.region  || null;
          city    = geo.city    || null;
          lat     = geo.ll?.[0] ?? null;
          lon     = geo.ll?.[1] ?? null;
        }
      }

      // UA parse
      let uaBrowser = '', uaOs = '', uaDevice = 'desktop';
      if (UAParser && ua) {
        const p = new UAParser(ua).getResult();
        uaBrowser = `${p.browser.name || ''} ${p.browser.major || ''}`.trim();
        uaOs      = `${p.os.name || ''} ${p.os.version || ''}`.trim();
        uaDevice  = p.device.type || 'desktop';
      }

      const bytesRaw = res.getHeader('content-length');
      const bytes = bytesRaw ? parseInt(bytesRaw as string) : 0;

      enqueue([
        ip, visitorId, country, region, city, lat, lon,
        req.method, urlPath.slice(0, 1024), res.statusCode, duration,
        ua, uaBrowser.slice(0, 128), uaOs.slice(0, 128), uaDevice.slice(0, 64),
        referer, bytes,
        authIdentity.userId,
        authIdentity.username,
      ]);
    } catch { /* never crash the app */ }
  });

  next();
}

