/**
 * aiService.ts — AI 歌词分析服务（OpenAI 兼容 API）
 *
 * 能力：
 *  1. analyzeLyrics()   — 判断 VOCAL/INSTRUMENTAL + 清洗出纯歌词（保留时间戳）
 *  2. extractCredits()  — 抽取创作者信息（角色 + 人名列表）
 *
 * 配置（.env）：
 *  AI_API_BASE_URL   OpenAI 兼容端点，如 https://api.deepseek.com/v1
 *  AI_API_KEY        API 密钥；未配置时进入 MOCK 模式（返回固定示例，用于本地跑通流程）
 *  AI_MODEL          模型名，默认 deepseek-chat
 *  AI_TIMEOUT_MS     超时，默认 120000
 *
 * 规则来源：2026-07-24/25 人工逐首验证过的 LRC 分类标准（785 INST / 158 VOCAL），
 * 以及 v13 创作者抽取（credit_key 恒等于 LRC 原文角色，人名拆分到个人）。
 */
import 'dotenv/config';

export interface CreditLine {
  /** 角色原文，如 "作曲 Composer"（恒等于 LRC 原文，不翻译不臆造） */
  role: string;
  /** 人名列表，如 ["车子玉 Ziyu Che (HOYO-MiX)"] */
  names: string[];
}

export interface LyricsAnalysis {
  /** vocal=有真歌词 / instrumental=纯器乐或纯 credit / unknown=无法判断 */
  kind: 'vocal' | 'instrumental' | 'unknown';
  /** 置信度 0-1 */
  confidence: number;
  /** 清洗后的歌词文本（仅 vocal；保留 [mm:ss.xx] 时间戳，去掉 credit 行/元数据行） */
  cleanLyrics: string | null;
  /** 从 LRC 中识别出的全部 credit 行（无论 vocal/inst，只要 LRC 里有 credit） */
  credits: CreditLine[];
}

interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

interface ChatResponse {
  choices?: { message?: { content?: string } }[];
}

const AI_BASE_URL = process.env.AI_API_BASE_URL?.replace(/\/+$/, '') || 'https://api.deepseek.com/v1';
const AI_API_KEY = process.env.AI_API_KEY || '';
const AI_MODEL = process.env.AI_MODEL || 'deepseek-chat';
const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 120000);

export const isMockMode = (): boolean => !AI_API_KEY;

// ── 系统提示词（分类 + 清洗）──────────────────────────────────────
const CLASSIFY_SYSTEM_PROMPT = `你是米哈游（HoYoVerse）游戏音乐 LRC 歌词分析专家。你的任务：判断一首 LRC 是 VOCAL（有真实人声歌词）还是 INSTRUMENTAL（纯器乐/纯创作者信息），并清洗歌词。

判断标准（经人工逐首验证）：
- "作曲 Composer：XXX" "二胡 Erhu：XXX" "录音棚 Recording Studio：XXX" "演唱 Artist：XXX" "合唱 Choir：XXX" 等「角色：人名」格式行 = 创作者/credit 信息，不是歌词
- "Let's pave it out and break through" "熱き波に触れ" "Ah, si je pouvais vivre dans l'eau" 等任何语言的人声歌词 = VOCAL
- "Hah~~" "(Over and over)" 等人声和音/念白 = VOCAL（也算歌词）
- 若文件中存在任何真实人声行 → 整首 = VOCAL
- 若全部是「角色：人名」格式 → INSTRUMENTAL
- [ti:]/[ar:]/[al:]/[by:]/[offset:] 等元数据头行不是歌词也不是 credit，清洗时删除

输出要求（严格 JSON，不要 markdown 代码块，不要任何其他文字）：
{"kind":"vocal|instrumental|unknown","confidence":0到1的小数,"clean_lyrics":"清洗后的LRC全文或null","credits":[{"role":"角色原文","names":["人名1","人名2"]}]}

- kind=instrumental 时 clean_lyrics 为 null
- clean_lyrics 仅含真实歌词行，保留 [mm:ss.xx] 时间戳，去掉所有 credit 行和元数据行
- credits 数组：LRC 中出现的所有「角色：人名」行，role 用 LRC 原文（不翻译不臆造），names 拆成个人（顿号/逗号/斜杠分隔，但保留括号内署名如 "(HOYO-MiX)"）
- 无法判断时 kind=unknown，confidence 给低分`;

// ── 系统提示词（仅抽取创作者，评估用）────────────────────────────
const EXTRACT_SYSTEM_PROMPT = `你是米哈游（HoYoVerse）游戏音乐 LRC 创作者信息提取器。你的任务：从 LRC 中提取所有创作者/制作人员信息。

规则：
- 提取所有「角色：人名」格式的行（作曲/作词/编曲/演唱/乐器/录音/混音/母带/出品等）
- role 必须使用 LRC 原文（如 "作曲 Composer"），不翻译、不改写、不臆造
- names 拆分为个人：用顿号、逗号、斜杠（/、/）或「feat.」「&」「and」分隔；人名内的括号署名（如 "车子玉 Ziyu Che (HOYO-MiX)"）必须保留在名字内
- 不要提取 [ti:]/[ar:]/[al:] 等元数据头，不要提取歌词行
- 只输出 JSON，不要 markdown 代码块，不要任何解释文字

输出格式：{"credits":[{"role":"角色原文","names":["人名1","人名2"]}]}`;

/** 调用 OpenAI 兼容 chat/completions */
async function chat(messages: ChatMessage[]): Promise<string> {
  if (isMockMode()) {
    throw new Error('AI_API_KEY 未配置，处于 MOCK 模式，无法真实调用');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    const res = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages,
        temperature: 0,
        max_tokens: 8000,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`AI API ${res.status}: ${body.slice(0, 300)}`);
    }
    const data = (await res.json()) as ChatResponse;
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('AI API 返回空内容');
    return content;
  } finally {
    clearTimeout(timer);
  }
}

/** 从模型输出中稳健提取 JSON（容忍 ```json 包裹或前后多余文字） */
function extractJson<T>(raw: string): T {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1].trim();
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first >= 0 && last > first) text = text.slice(first, last + 1);
  return JSON.parse(text) as T;
}

/** 归一化模型返回的 credits 数组 */
function normalizeCredits(raw: unknown): CreditLine[] {
  if (!Array.isArray(raw)) return [];
  const out: CreditLine[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const role = String((item as Record<string, unknown>).role ?? '').trim();
    const namesRaw = (item as Record<string, unknown>).names;
    const names = Array.isArray(namesRaw)
      ? namesRaw.map((n) => String(n).trim()).filter(Boolean)
      : [];
    if (role) out.push({ role, names });
  }
  return out;
}

// ── 公开 API ──────────────────────────────────────────────────────

/** 分析 LRC：分类 + 清洗 + credit 抽取（一次调用） */
export async function analyzeLyrics(lrcText: string): Promise<LyricsAnalysis> {
  const content = await chat([
    { role: 'system', content: CLASSIFY_SYSTEM_PROMPT },
    { role: 'user', content: `请分析以下 LRC：\n\n${lrcText}` },
  ]);
  const parsed = extractJson<{
    kind?: string;
    confidence?: number;
    clean_lyrics?: string | null;
    credits?: unknown;
  }>(content);

  const kindRaw = String(parsed.kind ?? '').trim().toLowerCase();
  const kind: LyricsAnalysis['kind'] =
    kindRaw === 'vocal' ? 'vocal' : kindRaw === 'instrumental' ? 'instrumental' : 'unknown';
  const confidence = Math.min(1, Math.max(0, Number(parsed.confidence) || 0));

  let cleanLyrics: string | null = null;
  if (kind === 'vocal' && typeof parsed.clean_lyrics === 'string' && parsed.clean_lyrics.trim()) {
    cleanLyrics = parsed.clean_lyrics.trim();
  }

  return {
    kind,
    confidence,
    cleanLyrics,
    credits: normalizeCredits(parsed.credits),
  };
}

/** 仅抽取创作者信息（评估用） */
export async function extractCredits(lrcText: string): Promise<CreditLine[]> {
  const content = await chat([
    { role: 'system', content: EXTRACT_SYSTEM_PROMPT },
    { role: 'user', content: `请提取以下 LRC 的创作者信息：\n\n${lrcText}` },
  ]);
  const parsed = extractJson<{ credits?: unknown }>(content);
  return normalizeCredits(parsed.credits);
}

// ── MOCK 实现（无 key 时本地跑通流程用）───────────────────────────

/** MOCK：根据 LRC 内容返回规则化的模拟结果（不调 API） */
export async function analyzeLyricsMock(lrcText: string): Promise<LyricsAnalysis> {
  const lines = lrcText.split(/\r?\n/);
  const creditPattern = /[:：].+/.test(lines.find((l) => l.includes('：') || l.includes(':')) ?? '');
  const hasLyricLine = lines.some((l) => /\[\d{2}:\d{2}(\.\d+)?\]/.test(l) && !/[:：]/.test(l.split(']')[1] ?? ''));
  // 简单启发式：有带时间戳的非 credit 行 → vocal
  const kind: LyricsAnalysis['kind'] = hasLyricLine ? 'vocal' : creditPattern ? 'instrumental' : 'unknown';
  const credits: CreditLine[] = lines
    .filter((l) => /[:：]/.test(l) && !/^\[(ti|ar|al|by|offset|re|ve)/i.test(l))
    .slice(0, 3)
    .map((l) => {
      const [, rest] = l.split(/[:：]/);
      const role = l.split(/[:：]/)[0].replace(/^\[\d{2}:\d{2}(\.\d+)?\]/, '').trim();
      return { role: role || '未知', names: rest ? [rest.trim()] : [] };
    });
  return {
    kind,
    confidence: 0.5,
    cleanLyrics: kind === 'vocal' ? lines.filter((l) => /\[\d{2}:\d{2}/.test(l) && !/[:：]/.test(l.split(']')[1] ?? '')).join('\n') : null,
    credits,
  };
}
