import { Router, Request, Response } from 'express';
import pool from '../config/database';
import { authenticateJWT } from '../middleware/auth';

const router = Router();
router.use(authenticateJWT as any);

// ── Helper ────────────────────────────────────────────────────────
const clampDays = (v: any, max = 90) => Math.min(Math.max(parseInt(v) || 30, 1), max);
/** Sanitized error message for production */
const safeError = (e: any) => {
  const msg = process.env.NODE_ENV === 'production' ? 'Internal server error' : (e?.message || 'Unknown error');
  return { success: false, error: { code: 'ANALYTICS_ERROR', message: msg } };
};

// ── Overview cards ────────────────────────────────────────────────
router.get('/overview', async (_req: Request, res: Response) => {
  try {
    const [total, today, unique7d, errors, avgMs] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS v FROM visit_logs`),
      pool.query(`SELECT COUNT(*)::int AS v FROM visit_logs WHERE ts >= (NOW() AT TIME ZONE 'Asia/Shanghai')::date AT TIME ZONE 'Asia/Shanghai'`),
      pool.query(`SELECT COUNT(DISTINCT ip)::int AS v FROM visit_logs WHERE ts >= NOW() - INTERVAL '7 days'`),
      pool.query(`SELECT COUNT(*)::int AS v FROM visit_logs WHERE status >= 400 AND ts >= (NOW() AT TIME ZONE 'Asia/Shanghai')::date AT TIME ZONE 'Asia/Shanghai'`),
      pool.query(`SELECT ROUND(AVG(duration_ms))::int AS v FROM visit_logs WHERE ts >= NOW() - INTERVAL '24 hours'`),
    ]);
    res.json({ success: true, data: {
      total:    total.rows[0].v,
      today:    today.rows[0].v,
      unique7d: unique7d.rows[0].v,
      errors:   errors.rows[0].v,
      avgMs:    avgMs.rows[0].v ?? 0,
    }});
  } catch (e: any) { res.status(500).json(safeError(e)); }
});

// ── Daily trend ───────────────────────────────────────────────────
router.get('/trend', async (req: Request, res: Response) => {
  try {
    const d = clampDays(req.query.days);
    const result = await pool.query(`
      SELECT
        DATE_TRUNC('day', ts AT TIME ZONE 'Asia/Shanghai')::date AS date,
        COUNT(*)::int               AS requests,
        COUNT(DISTINCT ip)::int     AS visitors
      FROM visit_logs
      WHERE ts >= NOW() - INTERVAL '1 day' * $1
      GROUP BY 1 ORDER BY 1
    `, [d]);
    res.json({ success: true, data: result.rows });
  } catch (e: any) { res.status(500).json(safeError(e)); }
});

// ── Hourly distribution (today) ───────────────────────────────────
router.get('/hourly', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT
        EXTRACT(HOUR FROM ts AT TIME ZONE 'Asia/Shanghai')::int AS hour,
        COUNT(*)::int AS requests,
        COUNT(DISTINCT ip)::int AS visitors
      FROM visit_logs
      WHERE ts >= (NOW() AT TIME ZONE 'Asia/Shanghai')::date AT TIME ZONE 'Asia/Shanghai'
      GROUP BY 1 ORDER BY 1
    `);
    res.json({ success: true, data: result.rows });
  } catch (e: any) { res.status(500).json(safeError(e)); }
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
      WHERE ts >= NOW() - INTERVAL '1 day' * $1
      GROUP BY 1 ORDER BY 3 DESC LIMIT 50
    `, [d]);
    res.json({ success: true, data: result.rows });
  } catch (e: any) { res.status(500).json(safeError(e)); }
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
      WHERE ts >= NOW() - INTERVAL '1 day' * $1
        AND latitude IS NOT NULL AND longitude IS NOT NULL
      GROUP BY 1,2,3,4 ORDER BY 5 DESC LIMIT 200
    `, [d]);
    res.json({ success: true, data: result.rows });
  } catch (e: any) { res.status(500).json(safeError(e)); }
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
      WHERE ts >= NOW() - INTERVAL '1 day' * $1
        AND method = 'GET'
      GROUP BY 1 ORDER BY 2 DESC LIMIT 50
    `, [d]);
    res.json({ success: true, data: result.rows });
  } catch (e: any) { res.status(500).json(safeError(e)); }
});

// ── Devices / Browsers / OS ───────────────────────────────────────
router.get('/devices', async (req: Request, res: Response) => {
  try {
    const d = clampDays(req.query.days);
    const [browsers, oses, devices] = await Promise.all([
      pool.query(`
        SELECT COALESCE(NULLIF(ua_browser,''),'Unknown') AS name, COUNT(*)::int AS value
        FROM visit_logs WHERE ts >= NOW() - INTERVAL '1 day' * $1
        GROUP BY 1 ORDER BY 2 DESC LIMIT 10
      `, [d]),
      pool.query(`
        SELECT COALESCE(NULLIF(ua_os,''),'Unknown') AS name, COUNT(*)::int AS value
        FROM visit_logs WHERE ts >= NOW() - INTERVAL '1 day' * $1
        GROUP BY 1 ORDER BY 2 DESC LIMIT 8
      `, [d]),
      pool.query(`
        SELECT COALESCE(NULLIF(ua_device,''),'desktop') AS name, COUNT(*)::int AS value
        FROM visit_logs WHERE ts >= NOW() - INTERVAL '1 day' * $1
        GROUP BY 1 ORDER BY 2 DESC
      `, [d]),
    ]);
    res.json({ success: true, data: { browsers: browsers.rows, oses: oses.rows, devices: devices.rows }});
  } catch (e: any) { res.status(500).json(safeError(e)); }
});

// ── Status codes ──────────────────────────────────────────────────
router.get('/status-codes', async (req: Request, res: Response) => {
  try {
    const d = clampDays(req.query.days);
    const result = await pool.query(`
      SELECT status::text AS name, COUNT(*)::int AS value
      FROM visit_logs WHERE ts >= NOW() - INTERVAL '1 day' * $1
      GROUP BY 1 ORDER BY 2 DESC
    `, [d]);
    res.json({ success: true, data: result.rows });
  } catch (e: any) { res.status(500).json(safeError(e)); }
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
      WHERE ts >= NOW() - INTERVAL '1 day' * $1
      GROUP BY 1 ORDER BY 1
    `, [d]);
    res.json({ success: true, data: result.rows });
  } catch (e: any) { res.status(500).json(safeError(e)); }
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
  } catch (e: any) { res.status(500).json(safeError(e)); }
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
      WHERE ts >= NOW() - INTERVAL '1 day' * $1
      GROUP BY 1 ORDER BY 2 DESC LIMIT 20
    `, [d]);
    res.json({ success: true, data: result.rows });
  } catch (e: any) { res.status(500).json(safeError(e)); }
});

// ── Storage analytics ─────────────────────────────────────────────
router.get('/storage', async (_req: Request, res: Response) => {
  try {
    const [totalStorage, byGame, byAlbum, qualityDist, formatDist] = await Promise.all([
      // Total storage
      pool.query(`
        SELECT
          COUNT(*)::int AS total_tracks,
          COALESCE(SUM(file_size), 0)::bigint AS total_bytes,
          ROUND(AVG(file_size))::bigint AS avg_file_size,
          COALESCE(SUM(duration), 0)::int AS total_duration
        FROM tracks
      `),
      // Storage by game
      pool.query(`
        SELECT
          COALESCE(g.name, 'Uncategorized') AS game_name,
          g.id AS game_id,
          COUNT(t.id)::int AS track_count,
          COALESCE(SUM(t.file_size), 0)::bigint AS total_bytes
        FROM tracks t
        LEFT JOIN albums a ON t.album_id = a.id
        LEFT JOIN games g ON a.game_id = g.id
        GROUP BY g.id, g.name
        ORDER BY total_bytes DESC
      `),
      // Storage by album (top 20)
      pool.query(`
        SELECT
          a.title AS album_title,
          a.id AS album_id,
          COUNT(t.id)::int AS track_count,
          COALESCE(SUM(t.file_size), 0)::bigint AS total_bytes
        FROM tracks t
        JOIN albums a ON t.album_id = a.id
        GROUP BY a.id, a.title
        ORDER BY total_bytes DESC
        LIMIT 20
      `),
      // Quality distribution (sample_rate)
      pool.query(`
        SELECT
          COALESCE(sample_rate, 0) AS sample_rate,
          COALESCE(bit_depth, 0) AS bit_depth,
          COUNT(*)::int AS count
        FROM tracks
        GROUP BY sample_rate, bit_depth
        ORDER BY count DESC
      `),
      // File size distribution
      pool.query(`
        SELECT
          CASE
            WHEN file_size < 10485760 THEN '< 10 MB'
            WHEN file_size < 52428800 THEN '10-50 MB'
            WHEN file_size < 104857600 THEN '50-100 MB'
            WHEN file_size < 209715200 THEN '100-200 MB'
            ELSE '> 200 MB'
          END AS size_range,
          COUNT(*)::int AS count
        FROM tracks
        GROUP BY 1
        ORDER BY MIN(file_size)
      `),
    ]);

    res.json({
      success: true,
      data: {
        summary: totalStorage.rows[0],
        byGame: byGame.rows,
        byAlbum: byAlbum.rows,
        qualityDistribution: qualityDist.rows,
        fileSizeDistribution: formatDist.rows,
      },
    });
  } catch (e: any) { res.status(500).json(safeError(e)); }
});

// ── Data Export ────────────────────────────────────────────────
router.get('/export', async (req: Request, res: Response) => {
  try {
    const format = (req.query.format as string) || 'json';

    const result = await pool.query(`
      SELECT t.id, t.title, t.track_number, t.disc_number,
             t.duration, t.file_size, t.sample_rate, t.bit_depth,
             t.release_date, t.created_at,
             a.title AS album_title,
             g.name AS game_name,
             ARRAY_AGG(DISTINCT ar.name) FILTER (WHERE ar.name IS NOT NULL) AS artists
      FROM tracks t
      LEFT JOIN albums a ON t.album_id = a.id
      LEFT JOIN games g ON a.game_id = g.id
      LEFT JOIN track_artists ta ON t.id = ta.track_id
      LEFT JOIN artists ar ON ta.artist_id = ar.id
      GROUP BY t.id, a.title, g.name
      ORDER BY t.id
    `);

    if (format === 'csv') {
      const header = 'id,title,album,game,artists,track_number,disc_number,duration,file_size,sample_rate,bit_depth,release_date,created_at\n';
      const rows = result.rows.map(r =>
        [r.id, `"${(r.title||'').replace(/"/g,'""')}"`, `"${(r.album_title||'').replace(/"/g,'""')}"`,
         `"${(r.game_name||'').replace(/"/g,'""')}"`, `"${(r.artists||[]).join('; ')}"`,
         r.track_number||'', r.disc_number||'', r.duration||'', r.file_size||'',
         r.sample_rate||'', r.bit_depth||'', r.release_date||'', r.created_at||''].join(',')
      ).join('\n');
      res.set('Content-Type', 'text/csv; charset=utf-8');
      res.set('Content-Disposition', 'attachment; filename="hoyomusic-export.csv"');
      return res.send('\uFEFF' + header + rows); // BOM for Excel compatibility
    }

    res.set('Content-Disposition', 'attachment; filename="hoyomusic-export.json"');
    res.json({ success: true, data: { tracks: result.rows, total: result.rows.length } });
  } catch (e: any) { res.status(500).json(safeError(e)); }
});

// ── Duplicate Detection ─────────────────────────────────────────
router.get('/duplicates', async (_req: Request, res: Response) => {
  try {
    // Find tracks with same title + duration (likely duplicates)
    const result = await pool.query(`
      SELECT t1.id AS id1, t2.id AS id2,
             t1.title, t1.duration,
             t1.file_size AS size1, t2.file_size AS size2,
             a1.title AS album1, a2.title AS album2
      FROM tracks t1
      JOIN tracks t2 ON t1.id < t2.id
                    AND LOWER(t1.title) = LOWER(t2.title)
                    AND ABS(COALESCE(t1.duration,0) - COALESCE(t2.duration,0)) < 2
      LEFT JOIN albums a1 ON t1.album_id = a1.id
      LEFT JOIN albums a2 ON t2.album_id = a2.id
      ORDER BY t1.title
      LIMIT 100
    `);

    res.json({ success: true, data: { duplicates: result.rows, count: result.rows.length } });
  } catch (e: any) { res.status(500).json(safeError(e)); }
});

export default router;

