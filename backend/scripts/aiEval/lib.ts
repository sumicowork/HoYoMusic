/**
 * aiEval/lib.ts — 评估用工具库
 *  - 读 LRC（自动探测 GBK/UTF-8 编码）
 *  - LRC 文件名 → DB track 匹配（归一化三层）
 *  - DB 连接（只读查询）
 */
import fs from 'fs';
import path from 'path';
import iconv from 'iconv-lite';
import { Client } from 'pg';

export interface TrackInfo {
  id: number;
  title: string;
  titleCn: string | null;
  titleEn: string | null;
  lyricsStatus: string | null; // none | has | instrumental | null
}

// ── LRC 读取 ──────────────────────────────────────────────────────

/** 读 LRC 文件并解码为 UTF-8（GBK 优先探测） */
export function readLrc(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  // 尝试 UTF-8（无 BOM 时宽松验证）
  const utf8 = buf.toString('utf8');
  if (!utf8.includes('\uFFFD') || buf.subarray(0, 3).toString('hex') === 'efbbbf') {
    return utf8;
  }
  try {
    return iconv.decode(buf, 'gbk');
  } catch {
    return utf8;
  }
}

/** 编码探测：返回 'gbk' | 'utf8' */
export function detectEncoding(filePath: string): 'gbk' | 'utf8' {
  const buf = fs.readFileSync(filePath);
  if (buf.subarray(0, 3).toString('hex') === 'efbbbf') return 'utf8';
  const utf8 = buf.toString('utf8');
  return utf8.includes('\uFFFD') ? 'gbk' : 'utf8';
}

// ── 名称归一化 ────────────────────────────────────────────────────

/** 宽松归一化：小写 + 去括号内容 + 所有分隔符折叠为空格（用于标题匹配） */
export function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/[（(【\[].*?[）)】\]]/g, ' ')
    .replace(/[\s_\-—·.,"'!?！？。，、]+/g, ' ')
    .trim();
}

/** 严格归一化：小写 + 去括号 + 去所有分隔符（用于人名匹配） */
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[（(].*?[）)]/g, '')
    .replace(/[\s_\-—·.,"'!?！？。，、]+/g, '')
    .trim();
}

// ── track 匹配 ────────────────────────────────────────────────────

/**
 * 用 LRC 文件名匹配 track。
 * 三层：整名精确 → 归一化精确（title/title_cn/title_en）→ 归一化后最长包含
 */
export function matchTrackByFilename(filename: string, tracks: TrackInfo[]): TrackInfo | null {
  const base = filename.replace(/\.lrc$/i, '').trim();
  const norm = normalizeTitle(base);
  if (!norm) return null;

  // 第一层：原文精确
  const exact = tracks.find((t) => t.title === base);
  if (exact) return exact;

  // 第二层：归一化精确（三个字段都试）
  const normMatches = tracks.filter(
    (t) =>
      normalizeTitle(t.title) === norm ||
      (t.titleCn && normalizeTitle(t.titleCn) === norm) ||
      (t.titleEn && normalizeTitle(t.titleEn) === norm),
  );
  if (normMatches.length === 1) return normMatches[0];
  if (normMatches.length > 1) return normMatches[0]; // 重名取第一个，评估时记为多候选

  // 第三层：归一化后包含（文件名含标题 或 标题含文件名，取最长公共）
  let best: TrackInfo | null = null;
  let bestLen = 0;
  for (const t of tracks) {
    const tn = normalizeTitle(t.title);
    if (!tn) continue;
    if (tn.includes(norm) || norm.includes(tn)) {
      const common = Math.min(tn.length, norm.length);
      if (common > bestLen) {
        best = t;
        bestLen = common;
      }
    }
  }
  return best;
}

// ── DB（只读）─────────────────────────────────────────────────────

export async function connectDb(): Promise<Client> {
  const client = new Client({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'hoyomusic',
  });
  await client.connect();
  return client;
}

/** 拉取全部 track 基本信息（内存匹配用） */
export async function fetchTracks(client: Client): Promise<TrackInfo[]> {
  const res = await client.query(
    `SELECT id, title, title_cn, title_en, lyrics_status FROM tracks`,
  );
  return res.rows.map((r) => ({
    id: r.id,
    title: r.title,
    titleCn: r.title_cn,
    titleEn: r.title_en,
    lyricsStatus: r.lyrics_status,
  }));
}

/** 拉取指定 track 的 credits 真值（人工 v13 落地） */
export async function fetchTrackCredits(client: Client, trackId: number): Promise<{ role: string; value: string }[]> {
  const res = await client.query(
    `SELECT credit_key AS role, credit_value AS value FROM track_credits WHERE track_id = $1 ORDER BY id`,
    [trackId],
  );
  return res.rows.map((r) => ({ role: r.role, value: r.value }));
}

/** 按游戏拉取 track 标题列表（抽样用；game 名如 '原神'/'绝区零'/'崩坏：星穹铁道'） */
export async function fetchTracksByGame(client: Client, gameName: string): Promise<TrackInfo[]> {
  const res = await client.query(
    `SELECT t.id, t.title, t.title_cn, t.title_en, t.lyrics_status
     FROM tracks t JOIN albums a ON a.id = t.album_id JOIN games g ON g.id = a.game_id
     WHERE g.name = $1`,
    [gameName],
  );
  return res.rows.map((r) => ({
    id: r.id,
    title: r.title,
    titleCn: r.title_cn,
    titleEn: r.title_en,
    lyricsStatus: r.lyrics_status,
  }));
}

// ── 文件遍历 ──────────────────────────────────────────────────────

/** 递归列出目录下所有 .lrc 文件 */
export function listLrcFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.lrc$/i.test(entry.name)) out.push(full);
    }
  };
  walk(root);
  return out;
}
