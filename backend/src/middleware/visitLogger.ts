import { Request, Response, NextFunction } from 'express';
import pool from '../config/database';

// Lazily load geoip-lite and ua-parser-js so startup isn't blocked
let geoip: any = null;
let UAParser: any = null;
try { geoip = require('geoip-lite'); } catch { /* optional */ }
try { UAParser = require('ua-parser-js'); } catch { /* optional */ }

// Skip recording for these path prefixes / patterns
const SKIP_PREFIXES = ['/uploads/', '/api/public/covers/proxy'];
const SKIP_PATTERNS = [/\/stream(\?|$)/, /\.(woff2?|ttf|ico|svg|map)(\?|$)/i];

function getRealIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string') return fwd.split(',')[0].trim();
  return (req.socket?.remoteAddress || '0.0.0.0').replace(/^::ffff:/, '');
}

export function visitLogger(req: Request, res: Response, next: NextFunction) {
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

      pool.query(
        `INSERT INTO visit_logs
          (ip, country, region, city, latitude, longitude,
           method, path, status, duration_ms,
           user_agent, ua_browser, ua_os, ua_device,
           referer, bytes_sent)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [ip, country, region, city, lat, lon,
         req.method, urlPath.slice(0, 1024), res.statusCode, duration,
         ua, uaBrowser.slice(0,128), uaOs.slice(0,128), uaDevice.slice(0,64),
         referer, bytes]
      ).catch((err: Error) => {
        // Table might not exist yet on first boot — silent fail
        if (!err.message.includes('visit_logs')) {
          console.warn('[visitLogger]', err.message);
        }
      });
    } catch { /* never crash the app */ }
  });

  next();
}

