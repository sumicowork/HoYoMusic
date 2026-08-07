#!/usr/bin/env node
/**
 * ESA 离线日志拉取入库（方案C：边缘全量 → host 过滤 → 本地聚合）
 * 用法（服务器 /opt/hoyomusic 下）:
 *   node scripts/esa/ingestEdgeLogs.cjs            # 拉最近 24 小时窗口内已就绪的日志包
 *   node scripts/esa/ingestEdgeLogs.cjs --hours=48 # 自定义窗口
 *   node scripts/esa/ingestEdgeLogs.cjs --full     # 回填最近 31 天
 * 幂等：按日志包 log_name 记录 esa_log_ingest_state，重复执行不重复入库。
 * 建议 cron：每天 04:00 执行（离线日志延迟 6-8 小时，此时昨天/前天的包已就绪）。
 */
const { Pool } = require('pg');
const fs = require('fs');
const https = require('https');
const zlib = require('zlib');
const path = require('path');

try { require('dotenv').config(); } catch { /* 服务器有 dotenv，本地无则忽略 */ }

const ESAModule = require('@alicloud/esa20240910');
const OpenApiCore = require('@alicloud/openapi-core');

let UAParser = null;
try { UAParser = require(path.join(__dirname, '..', '..', 'node_modules', 'ua-parser-js')); } catch { /* optional */ }

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432', 10),
  user: process.env.PGUSER || 'sumicowork',
  password: process.env.PGPASSWORD || 'cKj46Xyw8tfT5znQ',
  database: process.env.PGDATABASE || 'hoyomusic',
});

const ESA_SITE_ID = process.env.ESA_SITE_ID || '';
const ESA_AK = process.env.ESA_ACCESS_KEY_ID || '';
const ESA_SK = process.env.ESA_ACCESS_KEY_SECRET || '';
// 只入库该 Host 的日志（默认 music.hoyodb.com）
const HOST_FILTER = (process.env.ESA_HOST_FILTER || 'music.hoyodb.com').toLowerCase();
// 离线日志延迟约 6-8 小时；默认拉「now-8h ~ now-8h-窗口」的包
const LOOKBACK_HOURS = parseInt(process.env.ESA_LOG_LOOKBACK_HOURS || '8', 10);

const args = process.argv.slice(2);
const hoursArg = args.find((a) => a.startsWith('--hours='));
const full = args.includes('--full');
const WINDOW_HOURS = full ? 31 * 24 : parseInt(hoursArg ? hoursArg.slice(8) : '24', 10);

if (!ESA_SITE_ID || !ESA_AK || !ESA_SK) {
  console.error('缺少 ESA_SITE_ID / ESA_ACCESS_KEY_ID / ESA_ACCESS_KEY_SECRET 配置');
  process.exit(1);
}

function getClient() {
  const config = new OpenApiCore.$OpenApiUtil.Config({
    accessKeyId: ESA_AK,
    accessKeySecret: ESA_SK,
    regionId: process.env.ESA_REGION_ID || 'cn-hangzhou',
    endpoint: process.env.ESA_ENDPOINT || 'esa.cn-hangzhou.aliyuncs.com',
    readTimeout: 15000,
    connectTimeout: 15000,
  });
  return new ESAModule.default(config);
}

function downloadGz(url) {
  return new Promise((resolve, reject) => {
    const full = url.startsWith('http') ? url : 'https://' + url;
    https.get(full, (res) => {
      if (res.statusCode >= 400) return reject(new Error(`HTTP ${res.statusCode}`));
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        try {
          const plain = zlib.gunzipSync(Buffer.concat(chunks)).toString('utf8');
          resolve(plain);
        } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function parseUa(ua) {
  let browser = '', os = '', device = 'desktop';
  if (UAParser && ua) {
    try {
      const p = new UAParser(ua).getResult();
      browser = `${p.browser.name || ''} ${p.browser.major || ''}`.trim();
      os = `${p.os.name || ''} ${p.os.version || ''}`.trim();
      device = p.device.type || 'desktop';
    } catch { /* ignore */ }
  }
  return { browser: browser.slice(0, 128), os: os.slice(0, 128), device: device.slice(0, 64) };
}

async function main() {
  const client = getClient();
  const end = new Date(Date.now() - LOOKBACK_HOURS * 3600 * 1000);
  const start = new Date(end.getTime() - WINDOW_HOURS * 3600 * 1000);

  console.log(`[esa-ingest] 窗口 ${start.toISOString()} ~ ${end.toISOString()} (host=${HOST_FILTER})`);

  // 1. 分页拉日志包列表
  const packs = [];
  let page = 1;
  for (;;) {
    const req = new ESAModule.DescribeSiteLogsRequest({
      siteId: ESA_SITE_ID,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      pageNumber: page,
      pageSize: 100,
    });
    const resp = await client.describeSiteLogs(req);
    const d = resp?.body?.siteLogDetails?.[0];
    const infos = d?.logInfos || [];
    packs.push(...infos);
    const total = d?.pageInfos?.totalCount || 0;
    if (packs.length >= total || infos.length === 0) break;
    page += 1;
    if (page > 50) break; // 安全上限
  }
  console.log(`[esa-ingest] 日志包总数: ${packs.length}`);

  // 2. 过滤已处理
  const doneSet = new Set((await pool.query('SELECT log_name FROM esa_log_ingest_state')).rows.map((r) => r.log_name));
  const pending = packs.filter((p) => !doneSet.has(p.logName));
  console.log(`[esa-ingest] 待处理: ${pending.length}（已处理 ${packs.length - pending.length}）`);

  let inserted = 0, skipped = 0, totalRows = 0;
  for (const p of pending) {
    try {
      const plain = await downloadGz(p.logPath);
      const lines = plain.split('\n').filter((l) => l.trim());
      let rows = 0;
      const batch = [];
      for (const line of lines) {
        try {
          const j = JSON.parse(line);
          const host = String(j.ClientRequestHost || '').toLowerCase();
          if (!host || host !== HOST_FILTER) { skipped += 1; continue; }
          const ua = String(j.ClientRequestUserAgent || '').slice(0, 1024);
          const u = parseUa(ua);
          batch.push([
            String(j.ClientRequestID || '').slice(0, 64),
            new Date(j.EdgeStartTimestamp || Date.now()),
            host,
            String(j.ClientRequestMethod || '').slice(0, 10),
            String(j.ClientRequestScheme || '').slice(0, 10),
            String(j.ClientRequestURI || '').slice(0, 2048),
            String(j.ClientRequestReferer || '').slice(0, 1024),
            ua,
            u.browser, u.os, u.device,
            j.EdgeResponseStatusCode ?? null,
            String(j.EdgeCacheStatus || '').slice(0, 32) || null,
            j.EdgeTimeToFirstByteMs ?? null,
            j.ClientRequestBytes ?? null,
            j.EdgeResponseBytes ?? null,
            String(j.ClientCountryCode || '').slice(0, 8) || null,
            String(j.ClientRegionCode || '').slice(0, 128) || null,
            String(j.ClientISP || '').slice(0, 128) || null,
            String(j.ClientIP || '').slice(0, 64) || null,
          ]);
          rows += 1;
        } catch { /* skip bad line */ }
      }
      // 批量 upsert（req_id 幂等）
      for (let i = 0; i < batch.length; i += 500) {
        const chunk = batch.slice(i, i + 500);
        const ph = chunk.map((_, idx) => {
          const b = idx * 20;
          return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9},$${b + 10},$${b + 11},$${b + 12},$${b + 13},$${b + 14},$${b + 15},$${b + 16},$${b + 17},$${b + 18},$${b + 19},$${b + 20})`;
        }).join(',');
        await pool.query(
          `INSERT INTO esa_edge_logs
            (req_id, ts, host, method, scheme, uri, referer, ua, ua_browser, ua_os, ua_device,
             status, cache_status, ttfbm_ms, req_bytes, resp_bytes, country, region, isp, client_ip)
           VALUES ${ph}
           ON CONFLICT (req_id) DO NOTHING`,
          chunk.flat(),
        );
      }
      await pool.query('INSERT INTO esa_log_ingest_state (log_name) VALUES ($1) ON CONFLICT DO NOTHING', [p.logName]);
      inserted += rows;
      totalRows += rows;
      console.log(`[esa-ingest] ✓ ${p.logName} → ${rows} 行（host=${HOST_FILTER}）`);
    } catch (e) {
      console.error(`[esa-ingest] ✗ ${p.logName} 失败: ${e.message}`);
    }
  }

  const stat = await pool.query(
    `SELECT count(*)::int AS total, min(ts) AS min_ts, max(ts) AS max_ts FROM esa_edge_logs`,
  );
  console.log('════ 完成 ════');
  console.log(`新增 ${inserted} 行（过滤掉非目标 host ${skipped} 行）`);
  console.log(`表内总计: ${stat.rows[0].total} 行 | ${stat.rows[0].min_ts} ~ ${stat.rows[0].max_ts}`);
  await pool.end();
}

main().catch((e) => { console.error('FATAL:', e.message || e); process.exit(1); });
