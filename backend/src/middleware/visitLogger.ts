import { Request, Response, NextFunction } from 'express';
import pool from '../config/database';

type VisitLogEntry = [
  string,
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
];

// Lazily load geoip-lite and ua-parser-js so startup isn't blocked
let geoip: any = null;
let UAParser: any = null;
try { geoip = require('geoip-lite'); } catch { /* optional */ }
try { UAParser = require('ua-parser-js'); } catch { /* optional */ }

// Skip recording for these path prefixes / patterns
const SKIP_PREFIXES = ['/uploads/', '/api/public/covers/proxy'];
const SKIP_PATTERNS = [/\/stream(\?|$)/, /\.(woff2?|ttf|ico|svg|map)(\?|$)/i];
const VISIT_LOGGER_ENABLED = process.env.VISIT_LOGGER_ENABLED !== 'false';
const FLUSH_INTERVAL_MS = Math.max(200, parseInt(process.env.VISIT_LOGGER_FLUSH_MS || '1000', 10));
const BATCH_SIZE = Math.max(10, parseInt(process.env.VISIT_LOGGER_BATCH_SIZE || '30', 10));
const MAX_QUEUE_SIZE = Math.max(BATCH_SIZE, parseInt(process.env.VISIT_LOGGER_MAX_QUEUE || '5000', 10));

const queue: VisitLogEntry[] = [];
let flushing = false;

async function flushQueue(force = false): Promise<void> {
  if (flushing || queue.length === 0) return;
  if (!force && queue.length < BATCH_SIZE) return;

  flushing = true;
  const batch = queue.splice(0, Math.min(queue.length, BATCH_SIZE));

  try {
    const placeholders = batch.map((_, i) => {
      const base = i * 16;
      return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9},$${base + 10},$${base + 11},$${base + 12},$${base + 13},$${base + 14},$${base + 15},$${base + 16})`;
    }).join(',');
    const values = batch.flat();

    await pool.query(
      `INSERT INTO visit_logs
        (ip, country, region, city, latitude, longitude,
         method, path, status, duration_ms,
         user_agent, ua_browser, ua_os, ua_device,
         referer, bytes_sent)
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

function getRealIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string') return fwd.split(',')[0].trim();
  return (req.socket?.remoteAddress || '0.0.0.0').replace(/^::ffff:/, '');
}

export function visitLogger(req: Request, res: Response, next: NextFunction) {
  if (!VISIT_LOGGER_ENABLED) return next();

  const urlPath = req.path;
  if (SKIP_PREFIXES.some(p => urlPath.startsWith(p))) return next();
  if (SKIP_PATTERNS.some(p => p.test(urlPath))) return next();

  const startAt = Date.now();

  res.on('finish', () => {
    try {
      const duration = Date.now() - startAt;
      const ip = getRealIp(req);
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
        ip, country, region, city, lat, lon,
        req.method, urlPath.slice(0, 1024), res.statusCode, duration,
        ua, uaBrowser.slice(0, 128), uaOs.slice(0, 128), uaDevice.slice(0, 64),
        referer, bytes,
      ]);
    } catch { /* never crash the app */ }
  });

  next();
}

