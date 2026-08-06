/**
 * lyricsAnalysisWorker.ts — AI 歌词分析异步 worker
 *
 * 轮询 DB 中 lyrics_analysis_status='pending' 的曲目，调 aiService 分析并写回：
 *   - vocal         → lyrics_status='has', lyrics_text=清洗后歌词, status='done'
 *   - instrumental  → lyrics_status='instrumental', lyrics_text=NULL, status='done'
 *   - unknown/异常  → status='failed'（不瞎标，留待重试/人工）
 *   - 难点特征命中  → status='review'（角色行空、中文+拉丁连写等，人工定夺）
 *
 * 配置（.env）：
 *   AI_CONCURRENCY        并发数，默认 50
 *   AI_POLL_INTERVAL_MS   轮询间隔，默认 10000
 *   AI_WORKER_ENABLED     默认 'true'，设 'false' 关闭
 *
 * 启动：startLyricsAnalysisWorker()（幂等，内部 setInterval，不阻塞主进程）
 */
import { Pool, PoolClient } from 'pg';
import fs from 'fs/promises';
import https from 'https';
import http from 'http';
import { analyzeLyrics } from './aiService';

/** 生成艺术家 URL slug（与 scripts/backfillArtists.ts 一致：base-name + id 保证唯一） */
function slugify(name: string, id: number): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${base || 'artist'}-${id}`;
}

const AI_CONCURRENCY = Number(process.env.AI_CONCURRENCY || 50);
const AI_POLL_INTERVAL_MS = Number(process.env.AI_POLL_INTERVAL_MS || 10000);
const WORKER_ENABLED = (process.env.AI_WORKER_ENABLED || 'true') !== 'false';

/** 读取歌词文本（OSS 签名 URL 下载 / 本地文件），与 lyricsController 同逻辑 */
async function readLyricsContent(lyricsPath: string | null): Promise<string> {
  if (!lyricsPath) throw new Error('lyrics_path is empty');
  if ((lyricsPath.startsWith('http://') || lyricsPath.startsWith('https://')) && process.env.STORAGE_MODE === 'oss') {
    const { default: ossService } = await import('./ossService');
    const signedUrl = await ossService.getSignedUrl(lyricsPath, 300);
    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const client = signedUrl.startsWith('https') ? https : http;
      client.get(signedUrl, (res) => {
        if (res.statusCode !== 200) return reject(new Error(`OSS returned ${res.statusCode}`));
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      }).on('error', reject);
    });
    return buffer.toString('utf-8');
  }
  // 本地存储模式
  const { default: storageService } = await import('./storageService');
  const filePath = storageService.getFullPath(lyricsPath);
  return fs.readFile(filePath, 'utf-8');
}

/**
 * ⚠️ 广告残留过滤已撤回（2026-08-06）：原以为「您或许在找：」「おすすめは：」是 QQ
 * 接口夹带的广告，实锤为**歌词本体**——绝区零《天使加载中》中/日文版官方歌词
 * 都有这段「搜索框戏仿+话题标签」段落（萌娘百科/biligame 收录确认）。
 * 教训：LRC 行未经验证前不得以"看着像广告"为由删除。
 */

let workerTimer: NodeJS.Timeout | null = null;
const inFlight = new Set<number>();

/**
 * 确保创作者档案存在并返回其 id（新 credit 出现时自动建档，不再依赖手动 backfill）
 * - 精确匹配（trim 后）优先；命中 artist_aliases 别名规则时归并到 canonical_name
 * - 新建时 slug 即时补全（slugify(name, id)）
 */
async function ensureArtist(client: PoolClient, name: string): Promise<number | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  // 1. 别名规则 → canonical
  let canonical = trimmed;
  try {
    const alias = await client.query(
      `SELECT canonical_name FROM artist_aliases WHERE LOWER(alias_name) = LOWER($1) LIMIT 1`,
      [trimmed],
    );
    if (alias.rows[0]?.canonical_name) canonical = alias.rows[0].canonical_name.trim();
  } catch {
    /* artist_aliases 表不存在时忽略 */
  }
  // 2. 已存在（按 canonical 精确匹配）
  const exist = await client.query(`SELECT id FROM artists WHERE name = $1 LIMIT 1`, [canonical]);
  if (exist.rows[0]) return exist.rows[0].id as number;
  // 3. 新建（事务内，幂等）
  const ins = await client.query<{ id: number }>(
    `INSERT INTO artists (name, slug, type, created_at, updated_at)
     VALUES ($1, NULL, 'person', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     RETURNING id`,
    [canonical],
  );
  const id = ins.rows[0].id;
  await client.query(`UPDATE artists SET slug = $1 WHERE id = $2`, [slugify(canonical, id), id]);
  return id;
}

/** 落库创作者信息（幂等：先删后插；同时自动建档 artists 并回填 artist_id） */
async function saveCredits(pool: Pool, trackId: number, credits: unknown): Promise<void> {
  if (!Array.isArray(credits) || credits.length === 0) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM track_credits WHERE track_id = $1', [trackId]);
    let order = 0;
    let inserted = 0;
    for (const item of credits) {
      if (!item || typeof item !== 'object') continue;
      const role = String((item as Record<string, unknown>).role ?? '').trim();
      const namesRaw = (item as Record<string, unknown>).names;
      const names = Array.isArray(namesRaw)
        ? namesRaw.map((n) => String(n).trim()).filter(Boolean)
        : [];
      if (!role) continue;
      for (const name of names) {
        const artistId = await ensureArtist(client, name);
        await client.query(
          `INSERT INTO track_credits (track_id, credit_key, credit_value, display_order, artist_id) VALUES ($1, $2, $3, $4, $5)`,
          [trackId, role, name, order++, artistId],
        );
        inserted++;
      }
    }
    await client.query('COMMIT');
    if (inserted > 0) console.log(`[lyricsWorker] #${trackId} credits 落库 ${inserted} 行`);
  } catch (e: any) {
    await client.query('ROLLBACK');
    console.warn(`[lyricsWorker] #${trackId} credits 落库失败: ${e?.message ?? e}`);
  } finally {
    client.release();
  }
}

async function processOne(pool: Pool, trackId: number): Promise<void> {
  if (inFlight.has(trackId)) return;
  inFlight.add(trackId);
  try {
    const { rows } = await pool.query(
      `SELECT id, title, lyrics_path, lyrics_status, lyrics_analysis_status FROM tracks WHERE id = $1`,
      [trackId],
    );
    const track = rows[0];
    if (!track || track.lyrics_analysis_status !== 'pending') return;

    let lrc: string;
    try {
      lrc = await readLyricsContent(track.lyrics_path);
    } catch (err: any) {
      console.warn(`[lyricsWorker] #${trackId} 读歌词失败: ${err?.message ?? err} → failed`);
      await pool.query(`UPDATE tracks SET lyrics_analysis_status = 'failed' WHERE id = $1`, [trackId]);
      return;
    }

    // 难点特征检测已移除（2026-08-06）：原 empty_role_line 规则（时间戳+冒号结尾）
    // 误伤 16 首 vocal（角色对白/念白/歌词大意行的"角色名："标记被卡进 review），
    // 提示词已有念白/对白区分规则 + 置信度门槛兜底，此规则不再需要。

    // AI 分析（失败重试 1 次）
    let analysis;
    try {
      analysis = await analyzeLyrics(lrc);
    } catch (err: any) {
      try {
        analysis = await analyzeLyrics(lrc);
      } catch (err2: any) {
        console.warn(`[lyricsWorker] #${trackId} ${track.title} AI 失败: ${err2?.message ?? err2} → failed`);
        await pool.query(`UPDATE tracks SET lyrics_analysis_status = 'failed' WHERE id = $1`, [trackId]);
        return;
      }
    }

    if (analysis.kind === 'vocal' || analysis.kind === 'instrumental') {
      // 置信度门槛：低置信度不硬判，进 review 留人工定夺（防止假 vocal/假 instrumental 污染）
      if (analysis.confidence < 0.9) {
        console.warn(
          `[lyricsWorker] #${trackId} ${track.title} ${analysis.kind} 置信度 ${analysis.confidence.toFixed(2)} < 0.9 → review`,
        );
        await pool.query(`UPDATE tracks SET lyrics_analysis_status = 'review' WHERE id = $1`, [trackId]);
        return;
      }
    }

    if (analysis.kind === 'vocal') {
      // 后处理：HTML 实体解码（&#48520; → 불，QQ 韩语歌词常见）+ 剥离标题行
      let cleanLyrics = (analysis.cleanLyrics || '').trim();
      cleanLyrics = cleanLyrics
        .replace(/&#(\d+);/g, (_m, code) => String.fromCodePoint(Number(code)))
        .split('\n')
        .filter((l) => {
          const t = l.trim();
          return !/^\[\d{2}:\d{2}[.\d]*\]\s*[^-—]*[-—]\s*(HOYO-MiX|三Z-STUDIO)(\s*\/.*)?\s*$/i.test(t); // 标题行
        })
        .join('\n')
        .trim();
      // 剥离后无实际歌词行 → 降级为 instrumental
      const lyricLines = cleanLyrics.split('\n').filter((l) => l.trim());
      if (lyricLines.length === 0) {
        await pool.query(
          `UPDATE tracks SET lyrics_status = 'instrumental', lyrics_text = NULL, lyrics_analysis_status = 'done' WHERE id = $1`,
          [trackId],
        );
        console.log(`[lyricsWorker] #${trackId} ${track.title} → vocal 但无实际歌词，降级 instrumental`);
        await saveCredits(pool, trackId, analysis.credits);
        return;
      }
      await pool.query(
        `UPDATE tracks SET lyrics_status = 'has', lyrics_text = $2, lyrics_analysis_status = 'done' WHERE id = $1`,
        [trackId, cleanLyrics],
      );
      console.log(`[lyricsWorker] #${trackId} ${track.title} → vocal (conf ${analysis.confidence.toFixed(2)})`);
      await saveCredits(pool, trackId, analysis.credits);
    } else if (analysis.kind === 'instrumental') {
      await pool.query(
        `UPDATE tracks SET lyrics_status = 'instrumental', lyrics_text = NULL, lyrics_analysis_status = 'done' WHERE id = $1`,
        [trackId],
      );
      console.log(`[lyricsWorker] #${trackId} ${track.title} → instrumental (conf ${analysis.confidence.toFixed(2)})`);
      await saveCredits(pool, trackId, analysis.credits);
    } else {
      console.warn(`[lyricsWorker] #${trackId} ${track.title} unknown → failed`);
      await pool.query(`UPDATE tracks SET lyrics_analysis_status = 'failed' WHERE id = $1`, [trackId]);
    }
  } finally {
    inFlight.delete(trackId);
  }
}

/** 单轮：取出 pending 队列并并发处理 */
async function tick(pool: Pool): Promise<void> {
  try {
    const { rows } = await pool.query(
      `SELECT id FROM tracks WHERE lyrics_analysis_status = 'pending' ORDER BY id LIMIT $1`,
      [AI_CONCURRENCY * 2],
    );
    if (rows.length === 0) return;
    // 并发池
    let cursor = 0;
    await Promise.all(
      Array.from({ length: Math.min(AI_CONCURRENCY, rows.length) }, async () => {
        while (cursor < rows.length) {
          const row = rows[cursor++];
          await processOne(pool, row.id);
        }
      }),
    );
    if (rows.length > 0) {
      const { rows: remaining } = await pool.query(
        `SELECT count(*)::int AS n FROM tracks WHERE lyrics_analysis_status = 'pending'`,
      );
      if ((remaining[0]?.n ?? 0) > 0) console.log(`[lyricsWorker] 队列剩余 ${remaining[0].n}，继续`);
    }
  } catch (err: any) {
    console.error(`[lyricsWorker] tick 异常: ${err?.message ?? err}`);
  }
}

/** 启动 worker（幂等；不阻塞主进程） */
export function startLyricsAnalysisWorker(pool: Pool): void {
  if (!WORKER_ENABLED) {
    console.log('🔕 [lyricsWorker] AI_WORKER_ENABLED=false，未启动');
    return;
  }
  if (workerTimer) return;
  console.log(`🤖 [lyricsWorker] 启动：并发 ${AI_CONCURRENCY}，轮询 ${AI_POLL_INTERVAL_MS}ms`);
  void tick(pool); // 立即跑一轮
  workerTimer = setInterval(() => void tick(pool), AI_POLL_INTERVAL_MS);
  workerTimer.unref?.();
}

/** 停止 worker（测试/关闭用） */
export function stopLyricsAnalysisWorker(): void {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
  }
}
