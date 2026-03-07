import { Router, Request, Response } from 'express';
import pool from '../config/database';
import { authenticateJWT } from '../middleware/auth';

const router = Router();
router.use(authenticateJWT as any);

// ── Helper ────────────────────────────────────────────────────────
const days2interval = (d: number) => `${d} days`;
const clampDays = (v: any, max = 90) => Math.min(Math.max(parseInt(v) || 30, 1), max);

// ── Overview cards ────────────────────────────────────────────────
router.get('/overview', async (_req: Request, res: Response) => {
  try {
    const [total, today, unique7d, errors, avgMs] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS v FROM visit_logs`),
      pool.query(`SELECT COUNT(*)::int AS v FROM visit_logs WHERE ts >= CURRENT_DATE`),
      pool.query(`SELECT COUNT(DISTINCT ip)::int AS v FROM visit_logs WHERE ts >= NOW() - INTERVAL '7 days'`),
      pool.query(`SELECT COUNT(*)::int AS v FROM visit_logs WHERE status >= 400 AND ts >= CURRENT_DATE`),
      pool.query(`SELECT ROUND(AVG(duration_ms))::int AS v FROM visit_logs WHERE ts >= NOW() - INTERVAL '24 hours'`),
    ]);
    res.json({ success: true, data: {
      total:    total.rows[0].v,
      today:    today.rows[0].v,
      unique7d: unique7d.rows[0].v,
      errors:   errors.rows[0].v,
      avgMs:    avgMs.rows[0].v ?? 0,
    }});
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

// ── Daily trend ───────────────────────────────────────────────────
router.get('/trend', async (req: Request, res: Response) => {
  try {
    const d = clampDays(req.query.days);
    const result = await pool.query(`
      SELECT
        DATE_TRUNC('day', ts AT TIME ZONE 'UTC+8')::date AS date,
        COUNT(*)::int               AS requests,
        COUNT(DISTINCT ip)::int     AS visitors
      FROM visit_logs
      WHERE ts >= NOW() - INTERVAL '${days2interval(d)}'
      GROUP BY 1 ORDER BY 1
    `);
    res.json({ success: true, data: result.rows });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

// ── Hourly distribution (today) ───────────────────────────────────
router.get('/hourly', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT
        EXTRACT(HOUR FROM ts AT TIME ZONE 'UTC+8')::int AS hour,
        COUNT(*)::int AS requests,
        COUNT(DISTINCT ip)::int AS visitors
      FROM visit_logs
      WHERE ts >= CURRENT_DATE
      GROUP BY 1 ORDER BY 1
    `);
    res.json({ success: true, data: result.rows });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

// ── Countries ─────────────────────────────────────────────────────
router.get('/countries', async (req: Request, res: Response) => {
  try {
    const d = clampDays(req.query.days);
    const result = await pool.query(`
      SELECT
        COALESCE(NULLIF(country,''), 'Unknown') AS country,
        COUNT(*)::int           AS requests,
        COUNT(DISTINCT ip)::int AS visitors
      FROM visit_logs
      WHERE ts >= NOW() - INTERVAL '${days2interval(d)}'
      GROUP BY 1 ORDER BY 3 DESC LIMIT 50
    `);
    res.json({ success: true, data: result.rows });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

// ── Cities (for map) ──────────────────────────────────────────────
router.get('/cities', async (req: Request, res: Response) => {
  try {
    const d = clampDays(req.query.days);
    const result = await pool.query(`
      SELECT
        COALESCE(NULLIF(city,''), 'Unknown') AS city,
        COALESCE(NULLIF(country,''), '?')    AS country,
        latitude, longitude,
        COUNT(*)::int           AS requests,
        COUNT(DISTINCT ip)::int AS visitors
      FROM visit_logs
      WHERE ts >= NOW() - INTERVAL '${days2interval(d)}'
        AND latitude IS NOT NULL AND longitude IS NOT NULL
      GROUP BY 1,2,3,4 ORDER BY 5 DESC LIMIT 200
    `);
    res.json({ success: true, data: result.rows });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

// ── Top pages ─────────────────────────────────────────────────────
router.get('/pages', async (req: Request, res: Response) => {
  try {
    const d = clampDays(req.query.days);
    const result = await pool.query(`
      SELECT
        path,
        COUNT(*)::int                                  AS hits,
        COUNT(DISTINCT ip)::int                        AS visitors,
        ROUND(AVG(duration_ms))::int                   AS avg_ms,
        ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms))::int AS p95_ms,
        COUNT(*) FILTER (WHERE status >= 400)::int     AS errors
      FROM visit_logs
      WHERE ts >= NOW() - INTERVAL '${days2interval(d)}'
        AND method = 'GET'
      GROUP BY 1 ORDER BY 2 DESC LIMIT 50
    `);
    res.json({ success: true, data: result.rows });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

// ── Devices / Browsers / OS ───────────────────────────────────────
router.get('/devices', async (req: Request, res: Response) => {
  try {
    const d = clampDays(req.query.days);
    const [browsers, oses, devices] = await Promise.all([
      pool.query(`
        SELECT COALESCE(NULLIF(ua_browser,''),'Unknown') AS name, COUNT(*)::int AS value
        FROM visit_logs WHERE ts >= NOW() - INTERVAL '${days2interval(d)}'
        GROUP BY 1 ORDER BY 2 DESC LIMIT 10
      `),
      pool.query(`
        SELECT COALESCE(NULLIF(ua_os,''),'Unknown') AS name, COUNT(*)::int AS value
        FROM visit_logs WHERE ts >= NOW() - INTERVAL '${days2interval(d)}'
        GROUP BY 1 ORDER BY 2 DESC LIMIT 8
      `),
      pool.query(`
        SELECT COALESCE(NULLIF(ua_device,''),'desktop') AS name, COUNT(*)::int AS value
        FROM visit_logs WHERE ts >= NOW() - INTERVAL '${days2interval(d)}'
        GROUP BY 1 ORDER BY 2 DESC
      `),
    ]);
    res.json({ success: true, data: { browsers: browsers.rows, oses: oses.rows, devices: devices.rows }});
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

// ── Status codes ──────────────────────────────────────────────────
router.get('/status-codes', async (req: Request, res: Response) => {
  try {
    const d = clampDays(req.query.days);
    const result = await pool.query(`
      SELECT status::text AS name, COUNT(*)::int AS value
      FROM visit_logs WHERE ts >= NOW() - INTERVAL '${days2interval(d)}'
      GROUP BY 1 ORDER BY 2 DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

// ── Performance (avg/p95/max by hour) ────────────────────────────
router.get('/performance', async (req: Request, res: Response) => {
  try {
    const d = clampDays(req.query.days);
    const result = await pool.query(`
      SELECT
        DATE_TRUNC('hour', ts) AS hour,
        ROUND(AVG(duration_ms))::int AS avg_ms,
        ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms))::int AS p95_ms,
        MAX(duration_ms)::int AS max_ms,
        COUNT(*)::int AS requests
      FROM visit_logs
      WHERE ts >= NOW() - INTERVAL '${days2interval(d)}'
      GROUP BY 1 ORDER BY 1
    `);
    res.json({ success: true, data: result.rows });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

// ── Recent logs ───────────────────────────────────────────────────
router.get('/recent', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const result = await pool.query(`
      SELECT id, ts, ip, country, region, city,
             method, path, status, duration_ms,
             ua_browser, ua_os, ua_device, referer, bytes_sent
      FROM visit_logs ORDER BY ts DESC LIMIT $1
    `, [limit]);
    res.json({ success: true, data: result.rows });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

// ── Referers ──────────────────────────────────────────────────────
router.get('/referers', async (req: Request, res: Response) => {
  try {
    const d = clampDays(req.query.days);
    const result = await pool.query(`
      SELECT
        CASE WHEN referer IS NULL OR referer = '' THEN 'Direct / None'
             ELSE referer END AS referer,
        COUNT(*)::int AS hits
      FROM visit_logs
      WHERE ts >= NOW() - INTERVAL '${days2interval(d)}'
      GROUP BY 1 ORDER BY 2 DESC LIMIT 20
    `);
    res.json({ success: true, data: result.rows });
  } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
});

export default router;

