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
  album: string | null;
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

/** 部首区字符 → 主汉字：U+2F00 康熙部首（214 个，标准顺序）+ U+2E80 补充部首（仅实际出现的） */
const RADICAL_MAP: Record<string, string> = {
  '\u2ED8': '青', // ⻘ CJK RADICAL BLUE
  '\u2EDB': '风', // ⻛ C-SIMPLIFIED WIND
};
const KANGXI_RADICALS =
  '一丨丶丿乙亅二亠人儿入八冂冖冫几凵刀力勹匕匚匸十卜卩厂厶又口囗土士夂夊夕大女子宀寸小尢尸屮山巛工己巾干幺广廴廾弋弓彐彡彳心戈户手支攴文斗斤方无日曰月木欠止歹殳毋比毛氏气水火爪父爻爿片牙牛犬玄玉瓜瓦甘生用田疋疒癶白皮皿目矛矢石示禸禾穴立竹米糸缶网羊羽老而耒耳聿肉臣自至臼舌舛舟艮色艸虍虫血行衣襾見角言谷豆豕豸貝赤走足身車辛辰辵邑酉釆里金長門阜隶隹雨青非面革韋韭音頁風飛食首香馬骨高髟鬥鬯鬲鬼魚鳥鹵鹿麥麻黃黍黑黹黽鼎鼓鼠鼻齊齒龍龜龠';
for (let i = 0; i < KANGXI_RADICALS.length; i++) {
  RADICAL_MAP[String.fromCharCode(0x2f00 + i)] = KANGXI_RADICALS[i];
}

/** 宽松归一化：NFKC 兼容分解 + 部首区映射（⻘→青、⼈→人）+ 小写 + 去括号内容 + 所有分隔符折叠为空格（用于标题匹配） */
export function normalizeTitle(s: string): string {
  return s
    .normalize('NFKC')
    .replace(/[\u2e80-\u2fdf]/g, (ch) => RADICAL_MAP[ch] || ch) // 部首区单次正则替换
    .toLowerCase()
    .replace(/[（(【\[].*?[）)】\]]/g, ' ')
    .replace(/[\s_\-—·.,"'!?！？。，、…]+/g, ' ')
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
 * albumHint：LRC 所在专辑目录名（QQ 专辑）。同名不同专辑的曲目（同曲双收）内容可能不同，
 * 必须按专辑限定匹配范围，避免两份同名 LRC 全挂到第一个 track（如 千年之羽 Impact/Review）。
 */
export function matchTrackByFilename(
  filename: string,
  tracks: TrackInfo[],
  albumHint?: string | null,
  inAccScope = false,
): TrackInfo | null {
  const base = filename.replace(/\.lrc$/i, '').trim();
  const norm = normalizeTitle(base);
  if (!norm) return null;

  // 第零层（新增）：按专辑目录名限定——LRC 所在专辑与 DB 专辑 norm 相等时，只在该专辑 track 内匹配
  let scoped = tracks;
  if (albumHint) {
    const hintNorm = normalizeTitle(albumHint);
    if (hintNorm) {
      const scopedTracks = tracks.filter((t) => t.album && normalizeTitle(t.album) === hintNorm);
      if (scopedTracks.length > 0) scoped = scopedTracks;
    }
  }

  // 第零点五层（新增）：伴奏/纯乐文件名优先匹配伴奏/纯乐 track（避免挂到主歌后被剔除）
  const fileIsAcc = /伴奏|Instrumental|\(Inst/.test(base);
  if (fileIsAcc && !inAccScope) {
    const accScoped = scoped.filter((t) => /伴奏|Instrumental|\(Inst/.test(t.title));
    if (accScoped.length > 0) {
      const hit = matchTrackByFilename(filename, accScoped, null, true);
      if (hit) return hit;
    }
  }

  // 第一层：原文精确
  const exact = scoped.find((t) => t.title === base);
  if (exact) return exact;

  // 第二层：归一化精确（三个字段都试）
  const normMatches = scoped.filter(
    (t) =>
      normalizeTitle(t.title) === norm ||
      (t.titleCn && normalizeTitle(t.titleCn) === norm) ||
      (t.titleEn && normalizeTitle(t.titleEn) === norm),
  );
  if (normMatches.length === 1) return normMatches[0];
  if (normMatches.length > 1) return normMatches[0]; // 重名取第一个，评估时记为多候选

  // 第三层：词序无关精确（中英文顺序互换，如 QQ "A Sepulchral Gloom 如堕霓雾" vs DB "如堕霓雾 A Sepulchral Gloom"）
  // 必须在"包含"之前：包含层对顺序敏感，先走完等价类匹配再降级
  const sortWords = (s: string) => s.split(/\s+/).filter(Boolean).sort().join(' ');
  const normSorted = sortWords(norm);
  const sortedMatches = scoped.filter((t) => {
    const tn = normalizeTitle(t.title);
    if (tn && sortWords(tn) === normSorted) return true;
    if (t.titleCn && normalizeTitle(t.titleCn) && sortWords(normalizeTitle(t.titleCn)) === normSorted) return true;
    if (t.titleEn && normalizeTitle(t.titleEn) && sortWords(normalizeTitle(t.titleEn)) === normSorted) return true;
    return false;
  });
  if (sortedMatches.length >= 1) return sortedMatches[0];

  // 第四层：归一化后包含（文件名含标题 或 标题含文件名，取最长公共）
  // 门槛：共同部分 ≥ 8 字符 且 ≥ 较长者 60%——防短标题 track 被任意包含命中（如 "Y"）
  let best: TrackInfo | null = null;
  let bestLen = 0;
  for (const t of scoped) {
    const tn = normalizeTitle(t.title);
    if (!tn) continue;
    if (tn.includes(norm) || norm.includes(tn)) {
      const common = Math.min(tn.length, norm.length);
      const longer = Math.max(tn.length, norm.length);
      if (common >= 8 && common >= longer * 0.6 && common > bestLen) {
        best = t;
        bestLen = common;
      }
    }
  }
  if (best) return best;

  // 第五层（兜底）：专辑限定无命中时回退全局匹配（专辑目录名可能对不上 DB 专辑名）
  return matchTrackByFilename(filename, tracks, null);
}

// ── DB（只读）─────────────────────────────────────────────────────
// 优先用本地 dump（EVAL_DATA_DIR 指向 aiEval/data），避免依赖 ssh 隧道

let localTracks: TrackInfo[] | null = null;
let localCredits: Map<number, { role: string; value: string }[]> | null = null;

function loadLocalData(): { tracks: TrackInfo[]; credits: Map<number, { role: string; value: string }[]> } | null {
  const dir = process.env.EVAL_DATA_DIR;
  if (!dir) return null;
  const tracksFile = path.join(dir, 'tracks.json');
  const creditsFile = path.join(dir, 'credits.json');
  if (!fs.existsSync(tracksFile) || !fs.existsSync(creditsFile)) return null;
  const tracks = (JSON.parse(fs.readFileSync(tracksFile, 'utf8')) as any[])
    .filter((r) => !(r.source_type === 'EXTRA')) // EXTRA 专辑不参与自动匹配
    .map((r) => ({
      id: r.id,
      title: r.title,
      titleCn: r.title_cn,
      titleEn: r.title_en,
      album: r.album,
      lyricsStatus: r.lyrics_status,
    }));
  const credits = new Map<number, { role: string; value: string }[]>();
  for (const c of JSON.parse(fs.readFileSync(creditsFile, 'utf8')) as any[]) {
    const list = credits.get(c.track_id) || [];
    list.push({ role: c.role, value: c.value });
    credits.set(c.track_id, list);
  }
  return { tracks, credits };
}

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

/** 拉取全部 track 基本信息（内存匹配用；本地 dump 模式不连 DB） */
export async function fetchTracks(client: Client | null): Promise<TrackInfo[]> {
  if (localTracks) return localTracks;
  if (!localTracks && process.env.EVAL_DATA_DIR) {
    const data = loadLocalData();
    if (data) {
      localTracks = data.tracks;
      localCredits = data.credits;
      return localTracks;
    }
  }
  if (!client) throw new Error('无 DB 连接且无本地 dump');
  // EXTRA 专辑（外部提取、需人工关联）不参与任何自动匹配
  const res = await client.query(
    `SELECT t.id, t.title, t.title_cn, t.title_en, a.title AS album, t.lyrics_status
     FROM tracks t
     LEFT JOIN albums a ON a.id = t.album_id
     WHERE a.source_type IS NULL OR a.source_type <> 'EXTRA'`,
  );
  localTracks = res.rows.map((r) => ({
    id: r.id,
    title: r.title,
    titleCn: r.title_cn,
    titleEn: r.title_en,
    album: r.album,
    lyricsStatus: r.lyrics_status,
  }));
  return localTracks;
}

/** 拉取指定 track 的 credits 真值（人工 v13 落地；本地 dump 模式不连 DB） */
export async function fetchTrackCredits(client: Client | null, trackId: number): Promise<{ role: string; value: string }[]> {
  if (localCredits) return localCredits.get(trackId) || [];
  if (!localCredits && process.env.EVAL_DATA_DIR) {
    const data = loadLocalData();
    if (data) {
      localTracks = data.tracks;
      localCredits = data.credits;
      return localCredits.get(trackId) || [];
    }
  }
  if (!client) throw new Error('无 DB 连接且无本地 dump');
  const res = await client.query(
    `SELECT credit_key AS role, credit_value AS value FROM track_credits WHERE track_id = $1 ORDER BY id`,
    [trackId],
  );
  return res.rows.map((r) => ({ role: r.role, value: r.value }));
}

/** 按游戏拉取 track 标题列表（抽样用；game 名如 '原神'/'绝区零'/'崩坏：星穹铁道'） */
export async function fetchTracksByGame(client: Client, gameName: string): Promise<TrackInfo[]> {
  const res = await client.query(
    `SELECT t.id, t.title, t.title_cn, t.title_en, a.title AS album, t.lyrics_status
     FROM tracks t JOIN albums a ON a.id = t.album_id JOIN games g ON g.id = a.game_id
     WHERE g.name = $1`,
    [gameName],
  );
  return res.rows.map((r) => ({
    id: r.id,
    title: r.title,
    titleCn: r.title_cn,
    titleEn: r.title_en,
    album: r.album,
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
