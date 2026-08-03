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
import { Pool } from 'pg';
import fs from 'fs/promises';
import https from 'https';
import http from 'http';
import { analyzeLyrics } from './aiService';

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

/** 难点特征检测（代码层确定性规则，命中→review 待人工） */
export function detectHardCase(lrc: string): string | null {
  const lines = lrc.split(/\r?\n/);
  for (const l of lines) {
    if (!/\[\d{2}:\d{2}[.:\d]*\]/.test(l)) continue;
    // 1) 「角色：」冒号后为空，歌词可能在后续行（如 "念白："）——模型可能误删歌词
    if (/^\[\d{2}:\d{2}[.:\d]*\][^:：]{0,20}[:：]\s*$/.test(l)) return 'empty_role_line';
    // 注：中文+拉丁连写（郑宇界JODODO）不再标记 review——忠实原文原则下
    //     保持原文不拆即为正确行为，人名规范化是 artist 层的职责
  }
  return null;
}

let workerTimer: NodeJS.Timeout | null = null;
const inFlight = new Set<number>();

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

    // 难点特征 → review（保留人工定夺）
    const hardCase = detectHardCase(lrc);
    if (hardCase) {
      console.log(`[lyricsWorker] #${trackId} ${track.title} 命中难点特征(${hardCase}) → review`);
      await pool.query(`UPDATE tracks SET lyrics_analysis_status = 'review' WHERE id = $1`, [trackId]);
      return;
    }

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

    if (analysis.kind === 'vocal') {
      await pool.query(
        `UPDATE tracks SET lyrics_status = 'has', lyrics_text = $2, lyrics_analysis_status = 'done' WHERE id = $1`,
        [trackId, analysis.cleanLyrics],
      );
      console.log(`[lyricsWorker] #${trackId} ${track.title} → vocal (conf ${analysis.confidence.toFixed(2)})`);
    } else if (analysis.kind === 'instrumental') {
      await pool.query(
        `UPDATE tracks SET lyrics_status = 'instrumental', lyrics_text = NULL, lyrics_analysis_status = 'done' WHERE id = $1`,
        [trackId],
      );
      console.log(`[lyricsWorker] #${trackId} ${track.title} → instrumental (conf ${analysis.confidence.toFixed(2)})`);
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
