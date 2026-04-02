import { Router, Request, Response } from 'express';
import http from 'http';
import https from 'https';
import fs from 'fs/promises';
import path from 'path';
import pool from '../config/database';
import { authenticateAdmin } from '../middleware/auth';
import { cache } from '../utils/cache';
import remoteResourceCache from '../services/remoteResourceCache';
import storageService from '../services/storageService';
import { withReadableBehavior } from '../utils/behaviorAnalysis';
import analyticsEsaService from '../services/analyticsEsaService';

const router = Router();
router.use(authenticateAdmin as any);

// ── Helper ────────────────────────────────────────────────────────
const clampDays = (v: any, max = 90) => Math.min(Math.max(parseInt(v) || 30, 1), max);
const ESA_MAX_DAYS = 7;
const UNIQUE_VISITOR_EXPR = "COALESCE(NULLIF(visitor_id, ''), ip)";
const VISITOR_KEY_EXPR = "CASE WHEN visitor_id IS NOT NULL AND visitor_id <> '' THEN 'vid:' || visitor_id ELSE 'ip:' || COALESCE(ip, 'unknown') END";
const PROVINCE_KEYWORDS: Array<[string, string[]]> = [
  ['北京市', ['北京', 'beijing']],
  ['天津市', ['天津', 'tianjin']],
  ['上海市', ['上海', 'shanghai']],
  ['重庆市', ['重庆', 'chongqing']],
  ['河北省', ['河北', 'hebei']],
  ['山西省', ['山西', 'shanxi']],
  ['辽宁省', ['辽宁', 'liaoning']],
  ['吉林省', ['吉林', 'jilin']],
  ['黑龙江省', ['黑龙江', 'heilongjiang']],
  ['江苏省', ['江苏', 'jiangsu']],
  ['浙江省', ['浙江', 'zhejiang']],
  ['安徽省', ['安徽', 'anhui']],
  ['福建省', ['福建', 'fujian']],
  ['江西省', ['江西', 'jiangxi']],
  ['山东省', ['山东', 'shandong']],
  ['河南省', ['河南', 'henan']],
  ['湖北省', ['湖北', 'hubei']],
  ['湖南省', ['湖南', 'hunan']],
  ['广东省', ['广东', 'guangdong']],
  ['海南省', ['海南', 'hainan']],
  ['四川省', ['四川', 'sichuan']],
  ['贵州省', ['贵州', 'guizhou']],
  ['云南省', ['云南', 'yunnan']],
  ['陕西省', ['陕西', 'shaanxi']],
  ['甘肃省', ['甘肃', 'gansu']],
  ['青海省', ['青海', 'qinghai']],
  ['台湾省', ['台湾', 'taiwan']],
  ['内蒙古自治区', ['内蒙古', 'inner mongolia']],
  ['广西壮族自治区', ['广西', 'guangxi']],
  ['西藏自治区', ['西藏', 'tibet']],
  ['宁夏回族自治区', ['宁夏', 'ningxia']],
  ['新疆维吾尔自治区', ['新疆', 'xinjiang']],
  ['香港特别行政区', ['香港', 'hong kong']],
  ['澳门特别行政区', ['澳门', 'macao', 'macau']],
];

const PROVINCE_CODE_MAP: Record<string, string> = {
  '11': '北京市',
  '12': '天津市',
  '13': '河北省',
  '14': '山西省',
  '15': '内蒙古自治区',
  '21': '辽宁省',
  '22': '吉林省',
  '23': '黑龙江省',
  '31': '上海市',
  '32': '江苏省',
  '33': '浙江省',
  '34': '安徽省',
  '35': '福建省',
  '36': '江西省',
  '37': '山东省',
  '41': '河南省',
  '42': '湖北省',
  '43': '湖南省',
  '44': '广东省',
  '45': '广西壮族自治区',
  '46': '海南省',
  '50': '重庆市',
  '51': '四川省',
  '52': '贵州省',
  '53': '云南省',
  '54': '西藏自治区',
  '61': '陕西省',
  '62': '甘肃省',
  '63': '青海省',
  '64': '宁夏回族自治区',
  '65': '新疆维吾尔自治区',
  '71': '台湾省',
  '81': '香港特别行政区',
  '82': '澳门特别行政区',
  // common short codes
  BJ: '北京市',
  TJ: '天津市',
  HE: '河北省',
  SX: '山西省',
  NM: '内蒙古自治区',
  LN: '辽宁省',
  JL: '吉林省',
  HL: '黑龙江省',
  SH: '上海市',
  JS: '江苏省',
  ZJ: '浙江省',
  AH: '安徽省',
  FJ: '福建省',
  JX: '江西省',
  SD: '山东省',
  HA: '河南省',
  HB: '湖北省',
  HN: '湖南省',
  GD: '广东省',
  GX: '广西壮族自治区',
  HI: '海南省',
  CQ: '重庆市',
  SC: '四川省',
  GZ: '贵州省',
  YN: '云南省',
  XZ: '西藏自治区',
  SN: '陕西省',
  GS: '甘肃省',
  QH: '青海省',
  NX: '宁夏回族自治区',
  XJ: '新疆维吾尔自治区',
  TW: '台湾省',
  HK: '香港特别行政区',
  MO: '澳门特别行政区',
};

const toProvinceBucket = (country: string | null, region: string | null, city: string | null): string => {
  if (country !== 'CN') return '其他';
  const rawRegion = (region || '').trim();
  const regionUpper = rawRegion.toUpperCase();
  const numericMatch = regionUpper.match(/(?:CN[-_])?(\d{2})/);
  if (numericMatch && PROVINCE_CODE_MAP[numericMatch[1]]) {
    return PROVINCE_CODE_MAP[numericMatch[1]];
  }
  if (PROVINCE_CODE_MAP[regionUpper]) {
    return PROVINCE_CODE_MAP[regionUpper];
  }

  const text = `${region || ''} ${city || ''}`.toLowerCase();
  for (const [province, keywords] of PROVINCE_KEYWORDS) {
    if (keywords.some((k) => text.includes(k.toLowerCase()))) {
      return province;
    }
  }
  return '中国其他';
};
/** Sanitized error message for production */
const safeError = (e: any) => {
  const msg = process.env.NODE_ENV === 'production' ? 'Internal server error' : (e?.message || 'Unknown error');
  return { success: false, error: { code: 'ANALYTICS_ERROR', message: msg } };
};

const isEsaQuotaError = (error: any): boolean => {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  return code.includes('quotacheckfailed.function') || message.includes('quotacheckfailed.function');
};

const tryEsa = async <T>(label: string, fetcher: () => Promise<T>): Promise<T | null> => {
  if (!analyticsEsaService.isEnabled()) return null;
  try {
    return await fetcher();
  } catch (error: any) {
    if (isEsaQuotaError(error)) {
      console.warn(`[analytics][esa] ${label} unavailable in current ESA plan, fallback to sql: ${error?.message || error}`);
      return null;
    }
    if (analyticsEsaService.shouldThrowOnFailure()) {
      throw error;
    }
    console.warn(`[analytics][esa] ${label} failed, fallback to sql: ${error?.message || error}`);
    return null;
  }
};

const ROUTE_FILE_MOUNTS: Array<{ file: string; prefix: string }> = [
  { file: 'authRoutes.ts', prefix: '/api/auth' },
  { file: 'trackRoutes.ts', prefix: '/api/tracks' },
  { file: 'lyricsRoutes.ts', prefix: '/api/lyrics' },
  { file: 'creditsRoutes.ts', prefix: '/api/credits' },
  { file: 'albumRoutes.ts', prefix: '/api/albums' },
  { file: 'artistRoutes.ts', prefix: '/api/artists' },
  { file: 'gameRoutes.ts', prefix: '/api/games' },
  { file: 'tagRoutes.ts', prefix: '/api/tags' },
  { file: 'playlistRoutes.ts', prefix: '/api/playlists' },
  { file: 'favoriteRoutes.ts', prefix: '/api/favorites' },
  { file: 'discRoutes.ts', prefix: '/api' },
  { file: 'analyticsRoutes.ts', prefix: '/api/analytics' },
  { file: 'publicRoutes.ts', prefix: '/api/public' },
  { file: 'settingsRoutes.ts', prefix: '/api' },
  { file: 'userRoutes.ts', prefix: '/api/users' },
  { file: 'messageRoutes.ts', prefix: '/api/messages' },
];

const toCombinedPath = (prefix: string, routePath: string): string => {
  const left = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
  const right = routePath.startsWith('/') ? routePath : `/${routePath}`;
  return `${left}${right}`.replace(/\/+/g, '/');
};

const loadRouteInventory = async () => {
  const routesDir = path.join(__dirname);
  const out: Array<{ method: string; path: string; source: string }> = [];

  for (const item of ROUTE_FILE_MOUNTS) {
    let content = '';
    try {
      const targetTs = path.join(routesDir, item.file);
      content = await fs.readFile(targetTs, 'utf-8');
    } catch {
      try {
        const targetJs = path.join(routesDir, item.file.replace(/\.ts$/i, '.js'));
        content = await fs.readFile(targetJs, 'utf-8');
      } catch {
        continue;
      }
    }

    const regex = /router\.(get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]/g;
    let match: RegExpExecArray | null = regex.exec(content);
    while (match) {
      out.push({
        method: String(match[1] || '').toUpperCase(),
        path: toCombinedPath(item.prefix, String(match[2] || '')),
        source: item.file,
      });
      match = regex.exec(content);
    }
  }

  return out;
};

const fetchUrlBuffer = async (url: string): Promise<{ statusCode: number; buffer: Buffer; contentType: string }> => {
  return await new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (resp) => {
      const chunks: Buffer[] = [];
      resp.on('data', (chunk: Buffer) => chunks.push(chunk));
      resp.on('end', () => {
        resolve({
          statusCode: resp.statusCode || 200,
          buffer: Buffer.concat(chunks),
          contentType: (resp.headers['content-type'] as string) || 'application/octet-stream',
        });
      });
      resp.on('error', reject);
    }).on('error', reject);
  });
};

const warmupRemoteResourceCache = async () => {
  const summary = {
    enabled: remoteResourceCache.isEnabled(),
    storageMode: storageService.isOSS() ? 'oss' : storageService.isWebDAV() ? 'webdav' : 'local',
    covers: { checked: 0, fetched: 0, skipped: 0, failed: 0 },
    lyrics: { checked: 0, fetched: 0, skipped: 0, failed: 0 },
  };

  if (!remoteResourceCache.isEnabled() || !storageService.isOSS()) {
    return summary;
  }

  const ossService = (await import('../services/ossService')).default;
  const coverLimit = Math.min(Math.max(parseInt(process.env.WARMUP_REMOTE_COVERS_LIMIT || '80', 10), 1), 300);
  const lyricsLimit = Math.min(Math.max(parseInt(process.env.WARMUP_REMOTE_LYRICS_LIMIT || '80', 10), 1), 300);

  const [coversResult, lyricsResult] = await Promise.all([
    pool.query(
      `SELECT cover_path FROM (
         SELECT cover_path, updated_at FROM albums WHERE cover_path IS NOT NULL AND cover_path <> ''
         UNION
         SELECT cover_path, updated_at FROM tracks WHERE cover_path IS NOT NULL AND cover_path <> ''
         UNION
         SELECT cover_path, updated_at FROM games  WHERE cover_path IS NOT NULL AND cover_path <> ''
       ) c
       ORDER BY updated_at DESC NULLS LAST
       LIMIT $1`,
      [coverLimit]
    ),
    pool.query(
      `SELECT lyrics_path
       FROM tracks
       WHERE lyrics_path IS NOT NULL AND lyrics_path <> ''
       ORDER BY updated_at DESC NULLS LAST
       LIMIT $1`,
      [lyricsLimit]
    ),
  ]);

  const coverPaths = Array.from(new Set(coversResult.rows.map((r) => String(r.cover_path).trim()).filter(Boolean)));
  const lyricsPaths = Array.from(new Set(lyricsResult.rows.map((r) => String(r.lyrics_path).trim()).filter(Boolean)));

  for (const coverPath of coverPaths) {
    summary.covers.checked += 1;
    const cacheKey = `cover:${coverPath}:origin`;
    const cached = await remoteResourceCache.getBinary('covers', cacheKey);
    if (cached) {
      summary.covers.skipped += 1;
      continue;
    }

    try {
      const signedUrl = await ossService.getSignedUrl(coverPath, 600);
      const remote = await fetchUrlBuffer(signedUrl);
      if (remote.statusCode >= 200 && remote.statusCode < 300) {
        await remoteResourceCache.setBinary('covers', cacheKey, { buffer: remote.buffer, contentType: remote.contentType });
        summary.covers.fetched += 1;
      } else {
        summary.covers.failed += 1;
      }
    } catch {
      summary.covers.failed += 1;
    }
  }

  for (const lyricsPath of lyricsPaths) {
    summary.lyrics.checked += 1;
    const cacheKey = `lyrics:${lyricsPath}`;
    const cached = await remoteResourceCache.getBinary('lyrics', cacheKey);
    if (cached) {
      summary.lyrics.skipped += 1;
      continue;
    }

    try {
      const signedUrl = await ossService.getSignedUrl(lyricsPath, 600);
      const remote = await fetchUrlBuffer(signedUrl);
      if (remote.statusCode >= 200 && remote.statusCode < 300) {
        await remoteResourceCache.setBinary('lyrics', cacheKey, {
          buffer: remote.buffer,
          contentType: remote.contentType || 'text/plain; charset=utf-8',
        });
        summary.lyrics.fetched += 1;
      } else {
        summary.lyrics.failed += 1;
      }
    } catch {
      summary.lyrics.failed += 1;
    }
  }

  return summary;
};

const warmupAppCache = async () => {
  const warmKeys: string[] = [];

  const games = await pool.query(`
    SELECT
      g.*,
      COUNT(DISTINCT a.id) as album_count
    FROM games g
    LEFT JOIN albums a ON g.id = a.game_id
    GROUP BY g.id
    ORDER BY g.display_order ASC, g.name ASC
  `);
  cache.set('games:all', games.rows, 300);
  warmKeys.push('games:all');

  const tags = await pool.query(`
    SELECT
      t.*,
      tg.name as group_name,
      tg.icon as group_icon,
      tg.display_order as group_order,
      pt.name as parent_name,
      COUNT(DISTINCT tt.track_id) as track_count,
      (
        SELECT COUNT(*)
        FROM tags ct
        WHERE ct.parent_id = t.id
      ) as children_count
    FROM tags t
    LEFT JOIN tag_groups tg ON t.group_id = tg.id
    LEFT JOIN tags pt ON t.parent_id = pt.id
    LEFT JOIN track_tags tt ON t.id = tt.tag_id
    GROUP BY t.id, tg.name, tg.icon, tg.display_order, pt.name
    ORDER BY
      tg.display_order ASC NULLS LAST,
      t.parent_id ASC NULLS FIRST,
      t.display_order ASC,
      t.name ASC
  `);
  cache.set('tags:all', tags.rows, 300);
  warmKeys.push('tags:all');

  const artistCount = await pool.query(`
    SELECT COUNT(DISTINCT tc.credit_value)
    FROM track_credits tc
    WHERE tc.credit_value IS NOT NULL AND tc.credit_value <> ''
  `);
  const artistRows = await pool.query(`
    SELECT
      tc.credit_value                         AS name,
      COUNT(DISTINCT tc.track_id)             AS track_count,
      COUNT(DISTINCT t.album_id)              AS album_count,
      array_agg(DISTINCT tc.credit_key)       AS roles
    FROM track_credits tc
    LEFT JOIN tracks t ON tc.track_id = t.id
    WHERE tc.credit_value IS NOT NULL AND tc.credit_value <> ''
    GROUP BY tc.credit_value
    ORDER BY COUNT(DISTINCT tc.track_id) DESC, tc.credit_value ASC
    LIMIT $1 OFFSET $2
  `, [100, 0]);
  cache.set('artists:p1:l100', {
    success: true,
    data: {
      artists: artistRows.rows,
      pagination: {
        page: 1,
        limit: 100,
        total: parseInt(artistCount.rows[0].count),
        totalPages: Math.ceil(parseInt(artistCount.rows[0].count) / 100),
      },
    },
  }, 180);
  warmKeys.push('artists:p1:l100');

  const albumCount = await pool.query(`SELECT COUNT(*) FROM albums a`);
  const albumRows = await pool.query(`
    SELECT
      a.*,
      COUNT(DISTINCT t.id) as track_count,
      MIN(t.duration) as min_duration,
      SUM(t.duration) as total_duration
    FROM albums a
    LEFT JOIN tracks t ON a.id = t.album_id
    GROUP BY a.id
    ORDER BY COALESCE(a.release_date, a.created_at) DESC, a.title ASC
    LIMIT $1 OFFSET $2
  `, [20, 0]);
  cache.set('albums:p1:l20', {
    success: true,
    data: {
      albums: albumRows.rows,
      pagination: {
        page: 1,
        limit: 20,
        total: parseInt(albumCount.rows[0].count),
        totalPages: Math.ceil(parseInt(albumCount.rows[0].count) / 20),
      },
    },
  }, 300);
  warmKeys.push('albums:p1:l20');

  return warmKeys;
};

// ── Overview cards ────────────────────────────────────────────────
router.get('/overview', async (_req: Request, res: Response) => {
  try {
    const esaData = await tryEsa('overview', async () => analyticsEsaService.getOverview());
    if (esaData) {
      return res.json({ success: true, data: esaData });
    }

    const [total, today, unique7d, errors, avgMs] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS v FROM visit_logs WHERE ts >= NOW() - INTERVAL '7 days'`),
      pool.query(`SELECT COUNT(*)::int AS v FROM visit_logs WHERE ts >= (NOW() AT TIME ZONE 'Asia/Shanghai')::date AT TIME ZONE 'Asia/Shanghai'`),
      pool.query(`SELECT COUNT(DISTINCT ${UNIQUE_VISITOR_EXPR})::int AS v FROM visit_logs WHERE ts >= NOW() - INTERVAL '7 days'`),
      pool.query(`SELECT COUNT(*)::int AS v FROM visit_logs WHERE status >= 400 AND ts >= (NOW() AT TIME ZONE 'Asia/Shanghai')::date AT TIME ZONE 'Asia/Shanghai'`),
      pool.query(`SELECT ROUND(AVG(duration_ms))::int AS v FROM visit_logs WHERE ts >= NOW() - INTERVAL '24 hours'`),
    ]);
    res.json({ success: true, data: {
      total:    total.rows[0].v,
      today:    today.rows[0].v,
      unique7d: unique7d.rows[0].v,
      errors:   errors.rows[0].v,
      avgMs:    avgMs.rows[0].v ?? 0,
      traffic:  0,
      requestTraffic: 0,
      pageView: today.rows[0].v,
    }});
  } catch (e: any) { res.status(500).json(safeError(e)); }
});

// ── Daily trend ───────────────────────────────────────────────────
router.get('/trend', async (req: Request, res: Response) => {
  try {
    const d = clampDays(req.query.days, ESA_MAX_DAYS);
    const esaData = await tryEsa('trend', async () => analyticsEsaService.getTrend(d));
    if (esaData) {
      return res.json({ success: true, data: esaData });
    }

    const result = await pool.query(`
      SELECT
        DATE_TRUNC('day', ts AT TIME ZONE 'Asia/Shanghai')::date AS date,
        COUNT(*)::int               AS requests,
        COUNT(DISTINCT ${UNIQUE_VISITOR_EXPR})::int AS visitors,
        0::int AS traffic,
        0::int AS requestTraffic,
        COUNT(*)::int AS pageView
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
      WITH hours AS (
        SELECT generate_series(0, 23) AS hour
      ),
      today_logs AS (
        SELECT
          EXTRACT(HOUR FROM ts AT TIME ZONE 'Asia/Shanghai')::int AS hour,
          visitor_id,
          ip
        FROM visit_logs
        WHERE (ts AT TIME ZONE 'Asia/Shanghai')::date = (NOW() AT TIME ZONE 'Asia/Shanghai')::date
      )
      SELECT
        h.hour,
        COALESCE(COUNT(t.hour), 0)::int AS requests,
        COALESCE(COUNT(DISTINCT COALESCE(NULLIF(t.visitor_id, ''), t.ip)), 0)::int AS visitors
      FROM hours h
      LEFT JOIN today_logs t ON t.hour = h.hour
      GROUP BY h.hour
      ORDER BY h.hour
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
        COALESCE(NULLIF(region,''), '') AS region,
        COALESCE(NULLIF(city,''), '') AS city,
        COUNT(*)::int AS requests,
        COUNT(DISTINCT ${UNIQUE_VISITOR_EXPR})::int AS visitors
      FROM visit_logs
      WHERE ts >= NOW() - INTERVAL '1 day' * $1
      GROUP BY 1,2,3
    `, [d]);

    const map = new Map<string, { country: string; requests: number; visitors: number }>();
    for (const row of result.rows) {
      const bucket = toProvinceBucket(row.country, row.region, row.city);
      const prev = map.get(bucket) || { country: bucket, requests: 0, visitors: 0 };
      prev.requests += Number(row.requests || 0);
      prev.visitors += Number(row.visitors || 0);
      map.set(bucket, prev);
    }

    const data = Array.from(map.values()).sort((a, b) => b.visitors - a.visitors).slice(0, 40);
    res.json({ success: true, data });
  } catch (e: any) { res.status(500).json(safeError(e)); }
});

// ── Countries mapping diagnostics (no manual SQL needed) ───────
router.get('/countries/debug', async (req: Request, res: Response) => {
  try {
    const d = clampDays(req.query.days, 180);
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 1000, 100), 5000);

    const result = await pool.query(
      `SELECT
         COALESCE(NULLIF(country,''), 'Unknown') AS country,
         COALESCE(NULLIF(region,''), '') AS region,
         COALESCE(NULLIF(city,''), '') AS city,
         COUNT(*)::int AS requests,
         COUNT(DISTINCT ${UNIQUE_VISITOR_EXPR})::int AS visitors
       FROM visit_logs
       WHERE ts >= NOW() - INTERVAL '1 day' * $1
       GROUP BY 1,2,3
       ORDER BY requests DESC
       LIMIT $2`,
      [d, limit]
    );

    const mappedRows = result.rows.map((row) => ({
      ...row,
      bucket: toProvinceBucket(row.country, row.region, row.city),
    }));

    const unmappedChina = mappedRows
      .filter((row) => row.country === 'CN' && row.bucket === '中国其他')
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 200);

    const bucketSummaryMap = new Map<string, { bucket: string; requests: number; visitors: number }>();
    for (const row of mappedRows) {
      const prev = bucketSummaryMap.get(row.bucket) || { bucket: row.bucket, requests: 0, visitors: 0 };
      prev.requests += Number(row.requests || 0);
      prev.visitors += Number(row.visitors || 0);
      bucketSummaryMap.set(row.bucket, prev);
    }

    const bucketSummary = Array.from(bucketSummaryMap.values()).sort((a, b) => b.requests - a.requests);

    res.json({
      success: true,
      data: {
        days: d,
        sampleRows: mappedRows.length,
        bucketSummary,
        unmappedChinaCount: unmappedChina.length,
        unmappedChina,
      },
    });
  } catch (e: any) {
    res.status(500).json(safeError(e));
  }
});

// ── Visitor list ─────────────────────────────────────────────────
router.get('/visitors', async (req: Request, res: Response) => {
  try {
    const d = clampDays(req.query.days, 180);
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 200);
    const offset = (page - 1) * limit;

    const [countResult, listResult] = await Promise.all([
      pool.query(
        `SELECT COUNT(*)::int AS total
         FROM (
           SELECT ${VISITOR_KEY_EXPR} AS visitor_key
           FROM visit_logs
           WHERE ts >= NOW() - INTERVAL '1 day' * $1
           GROUP BY 1
         ) v`,
        [d]
      ),
      pool.query(
        `SELECT
           ${VISITOR_KEY_EXPR} AS visitor_key,
           MAX(visitor_id) FILTER (WHERE visitor_id IS NOT NULL AND visitor_id <> '') AS visitor_id,
           MAX(ip) AS latest_ip,
           COUNT(*)::int AS requests,
           MIN(ts) AS first_seen,
           MAX(ts) AS last_seen,
           COUNT(DISTINCT path)::int AS unique_paths
         FROM visit_logs
         WHERE ts >= NOW() - INTERVAL '1 day' * $1
         GROUP BY 1
         ORDER BY MAX(ts) DESC
         LIMIT $2 OFFSET $3`,
        [d, limit, offset]
      ),
    ]);

    res.json({
      success: true,
      data: {
        visitors: listResult.rows,
        pagination: {
          page,
          limit,
          total: countResult.rows[0]?.total || 0,
          totalPages: Math.max(1, Math.ceil((countResult.rows[0]?.total || 0) / limit)),
        },
      },
    });
  } catch (e: any) {
    res.status(500).json(safeError(e));
  }
});

// ── Visitor behavior ─────────────────────────────────────────────
router.get('/visitors/:visitorKey/behavior', async (req: Request, res: Response) => {
  try {
    const d = clampDays(req.query.days, 180);
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 100, 1), 500);
    const visitorKey = decodeURIComponent(String(req.params.visitorKey || ''));

    let whereClause = '';
    let keyValue = '';
    if (visitorKey.startsWith('vid:')) {
      whereClause = "visitor_id = $1";
      keyValue = visitorKey.slice(4);
    } else if (visitorKey.startsWith('ip:')) {
      whereClause = "ip = $1";
      keyValue = visitorKey.slice(3);
    } else {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_VISITOR_KEY', message: 'Invalid visitor key' },
      });
    }

    const result = await pool.query(
      `SELECT
         ts,
         method,
         path,
         status,
         duration_ms,
         ip,
         visitor_id,
         country,
         region,
         city,
         referer
       FROM visit_logs
       WHERE ${whereClause}
         AND ts >= NOW() - INTERVAL '1 day' * $2
       ORDER BY ts DESC
       LIMIT $3`,
      [keyValue, d, limit]
    );

    const logs = result.rows.map((row) => withReadableBehavior(row));
    const actionCounter = new Map<string, { action_label: string; count: number }>();
    let errorRequests = 0;

    for (const row of logs) {
      if (Number(row.status) >= 400) {
        errorRequests += 1;
      }
      const key = String(row.action_key || 'api.generic');
      const existing = actionCounter.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        actionCounter.set(key, {
          action_label: String(row.action_label || '未知行为'),
          count: 1,
        });
      }
    }

    const topActions = Array.from(actionCounter.entries())
      .map(([action_key, value]) => ({ action_key, action_label: value.action_label, count: value.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    res.json({
      success: true,
      data: {
        visitorKey,
        summary: {
          totalRequests: logs.length,
          errorRequests,
          errorRate: logs.length > 0 ? Number(((errorRequests / logs.length) * 100).toFixed(1)) : 0,
          topActions,
        },
        logs,
      },
    });
  } catch (e: any) {
    res.status(500).json(safeError(e));
  }
});

router.get('/behavior/coverage', async (_req: Request, res: Response) => {
  try {
    const [inventory, genericResult, actionResult] = await Promise.all([
      loadRouteInventory(),
      pool.query(
        `SELECT method, path, COUNT(*)::int AS requests
         FROM visit_logs
         WHERE ts >= NOW() - INTERVAL '30 days'
         GROUP BY method, path
         ORDER BY COUNT(*) DESC
         LIMIT 800`
      ),
      pool.query(
        `SELECT method, path, status
         FROM visit_logs
         WHERE ts >= NOW() - INTERVAL '30 days'
         ORDER BY ts DESC
         LIMIT 2000`
      ),
    ]);

    const coveredSet = new Set<string>();
    for (const row of genericResult.rows) {
      coveredSet.add(`${String(row.method).toUpperCase()} ${String(row.path)}`);
    }

    const uncoveredRoutes = inventory
      .filter((route) => !coveredSet.has(`${route.method} ${route.path}`))
      .slice(0, 500);

    const actionCounter = new Map<string, { action_key: string; action_label: string; module: string; count: number }>();
    const unmappedCounter = new Map<string, { method: string; path: string; count: number }>();
    for (const row of actionResult.rows) {
      const behavior = withReadableBehavior(row);
      const key = behavior.action_key;
      const existing = actionCounter.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        actionCounter.set(key, {
          action_key: behavior.action_key,
          action_label: behavior.action_label,
          module: behavior.module,
          count: 1,
        });
      }

      if (behavior.action_key === 'api.generic') {
        const routeKey = `${String(row.method).toUpperCase()} ${String(row.path)}`;
        const unmapped = unmappedCounter.get(routeKey);
        if (unmapped) {
          unmapped.count += 1;
        } else {
          unmappedCounter.set(routeKey, {
            method: String(row.method || 'GET').toUpperCase(),
            path: String(row.path || '/'),
            count: 1,
          });
        }
      }
    }

    const actionDistribution = Array.from(actionCounter.values()).sort((a, b) => b.count - a.count);
    const unmappedTop = Array.from(unmappedCounter.values()).sort((a, b) => b.count - a.count).slice(0, 80);

    return res.json({
      success: true,
      data: {
        inventory: {
          total_routes: inventory.length,
          uncovered_count: uncoveredRoutes.length,
          uncovered_routes: uncoveredRoutes,
        },
        behavior: {
          action_distribution: actionDistribution,
          unmapped_top: unmappedTop,
        },
      },
    });
  } catch (e: any) {
    return res.status(500).json(safeError(e));
  }
});

router.get('/behavior/export', async (req: Request, res: Response) => {
  try {
    const d = clampDays(req.query.days, 180);
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 500, 1), 2000);
    const offset = (page - 1) * limit;
    const method = String(req.query.method || '').trim().toUpperCase();

    const conditions: string[] = [`ts >= NOW() - INTERVAL '1 day' * $1`];
    const params: Array<number | string> = [d];

    if (method) {
      params.push(method);
      conditions.push(`method = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit);
    params.push(offset);

    const result = await pool.query(
      `SELECT ts, method, path, status, duration_ms, ip, visitor_id, actor_user_id, actor_username, referer
       FROM visit_logs
       ${whereClause}
       ORDER BY ts DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const logs = result.rows.map((row) => withReadableBehavior(row));
    return res.json({
      success: true,
      data: {
        page,
        limit,
        days: d,
        logs,
      },
    });
  } catch (e: any) {
    return res.status(500).json(safeError(e));
  }
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
        COUNT(DISTINCT ${UNIQUE_VISITOR_EXPR})::int AS visitors
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
    const d = clampDays(req.query.days, ESA_MAX_DAYS);
    const esaData = await tryEsa('pages', async () => analyticsEsaService.getPages(d));
    if (esaData) {
      return res.json({ success: true, data: esaData });
    }

    const result = await pool.query(`
      SELECT
        path,
        COUNT(*)::int                                  AS hits,
        COUNT(DISTINCT ${UNIQUE_VISITOR_EXPR})::int   AS visitors,
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
    const d = clampDays(req.query.days, ESA_MAX_DAYS);
    const esaData = await tryEsa('status-codes', async () => analyticsEsaService.getStatusCodes(d));
    if (esaData) {
      return res.json({ success: true, data: esaData });
    }

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
    const d = clampDays(req.query.days, ESA_MAX_DAYS);
    const esaData = await tryEsa('performance', async () => analyticsEsaService.getPerformance(d));
    if (esaData) {
      return res.json({ success: true, data: esaData });
    }

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
      SELECT id, ts, ip, visitor_id, country, region, city,
             method, path, status, duration_ms,
             ua_browser, ua_os, ua_device, referer, bytes_sent
      FROM visit_logs ORDER BY ts DESC LIMIT $1
    `, [limit]);
    res.json({ success: true, data: result.rows });
  } catch (e: any) { res.status(500).json(safeError(e)); }
});

// ── Cache analytics ──────────────────────────────────────────────
router.get('/cache', async (_req: Request, res: Response) => {
  try {
    const [remote] = await Promise.all([
      remoteResourceCache.stats(),
    ]);

    res.json({
      success: true,
      data: {
        appCache: cache.snapshot(80),
        remoteCache: remote,
      },
    });
  } catch (e: any) { res.status(500).json(safeError(e)); }
});

// ── One-click refresh + prewarm ─────────────────────────────────
router.post('/cache/warmup', async (_req: Request, res: Response) => {
  try {
    cache.clear();
    const [warmedKeys, remoteWarmup] = await Promise.all([
      warmupAppCache(),
      warmupRemoteResourceCache(),
    ]);
    const [remote] = await Promise.all([
      remoteResourceCache.stats(),
    ]);

    res.json({
      success: true,
      data: {
        message: '缓存已刷新并完成预热',
        warmedKeys,
        remoteWarmup,
        appCache: cache.snapshot(80),
        remoteCache: remote,
      },
    });
  } catch (e: any) { res.status(500).json(safeError(e)); }
});

// ── Referers ──────────────────────────────────────────────────────
router.get('/referers', async (req: Request, res: Response) => {
  try {
    const d = clampDays(req.query.days, ESA_MAX_DAYS);
    const esaData = await tryEsa('referers', async () => analyticsEsaService.getReferers(d));
    if (esaData) {
      return res.json({ success: true, data: esaData });
    }

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

// ── Hot tracks by effective plays ────────────────────────────────
router.get('/tracks/hot', async (req: Request, res: Response) => {
  try {
    const d = clampDays(req.query.days, 180);
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 200);
    const result = await pool.query(
      `SELECT
         t.id AS track_id,
         t.title AS track_title,
         a.id AS album_id,
         a.title AS album_title,
         COUNT(*)::int AS effective_plays,
         COUNT(DISTINCT tpe.source_ip)::int AS unique_ips,
         ROUND(AVG(tpe.played_seconds)::numeric, 1) AS avg_played_seconds,
         MAX(tpe.played_at) AS last_played_at
       FROM track_play_events tpe
       JOIN tracks t ON tpe.track_id = t.id
       LEFT JOIN albums a ON t.album_id = a.id
       WHERE tpe.effective_play = TRUE
         AND tpe.played_at >= NOW() - INTERVAL '1 day' * $1
       GROUP BY t.id, t.title, a.id, a.title
       ORDER BY COUNT(*) DESC, MAX(tpe.played_at) DESC
       LIMIT $2`,
      [d, limit]
    );
    res.json({ success: true, data: result.rows });
  } catch (e: any) { res.status(500).json(safeError(e)); }
});

// ── Source IPs for a hot track ───────────────────────────────────
router.get('/tracks/:id/ip-sources', async (req: Request, res: Response) => {
  try {
    const d = clampDays(req.query.days, 180);
    const trackId = parseInt(String(req.params.id || ''), 10);
    if (!Number.isInteger(trackId) || trackId <= 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_TRACK_ID', message: 'Invalid track id' }
      });
    }

    const trackResult = await pool.query(
      'SELECT id AS track_id, title AS track_title FROM tracks WHERE id = $1 LIMIT 1',
      [trackId]
    );
    if (trackResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Track not found' }
      });
    }

    const ipResult = await pool.query(
      `SELECT
         source_ip AS ip,
         COUNT(*)::int AS effective_plays,
         ROUND(AVG(played_seconds)::numeric, 1) AS avg_played_seconds,
         MAX(played_at) AS last_played_at
       FROM track_play_events
       WHERE track_id = $1
         AND effective_play = TRUE
         AND played_at >= NOW() - INTERVAL '1 day' * $2
       GROUP BY source_ip
       ORDER BY COUNT(*) DESC, MAX(played_at) DESC
       LIMIT 500`,
      [trackId, d]
    );

    return res.json({
      success: true,
      data: {
        track: trackResult.rows[0],
        ipSources: ipResult.rows,
      }
    });
  } catch (e: any) { return res.status(500).json(safeError(e)); }
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

