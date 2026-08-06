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

/** 代理 dispatcher（Node fetch 不读 HTTP_PROXY 环境变量，需显式设置；生产直连时留空） */
function getDispatcher(): unknown {
  const proxy = process.env.AI_HTTP_PROXY || process.env.HTTPS_PROXY || '';
  if (!proxy) return undefined;
  try {
    // 动态 require 避免 TS/undici 类型耦合
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { ProxyAgent } = require('undici') as { ProxyAgent: new (url: string) => unknown };
    return new ProxyAgent(proxy);
  } catch {
    console.warn(`[aiService] 代理 ${proxy} 初始化失败，将直连`);
    return undefined;
  }
}

const dispatcher = getDispatcher();

// ── 系统提示词（分类 + 清洗）──────────────────────────────────────
const CLASSIFY_SYSTEM_PROMPT = `你是米哈游（HoYoVerse）游戏音乐 LRC 歌词分析专家。任务：判断一首 LRC 是 VOCAL（有真实人声歌词）还是 INSTRUMENTAL（纯器乐/纯创作者信息），并清洗出纯歌词、抽取创作者信息。

【行类型判定】（按优先级从上到下）
1. 元数据头：[ti:][ar:][al:][by:][offset:] 等 → 忽略，既不是歌词也不是 credit
2. 标题行：[mm:ss.xx]歌名 - 厂牌/歌手（如 "[00:00.20]万千星火的欢宴 With Zealous Passion We Rejoice - HOYO-MiX"）→ 忽略，不是歌词
3. 占位声明：内容为"此歌曲为没有填词的纯音乐"等 → 忽略；若全文仅此类占位声明 → INSTRUMENTAL
4. credit 行：「角色：人名/机构名」格式（作曲 Composer：xxx / 二胡 Erhu：xxx / 录音棚 Recording Studio：xxx / 演唱 Artist：xxx / 合唱 Choir：xxx / 制作人 Producer：xxx；出品 Produced by、Music by 也属 credit 型行）→ 创作者信息，不是歌词
5. 歌词行：其他任何语言的真实人声内容（含和音、哼唱 "Hah~~"、重复句 "(Over and over)"）→ 歌词
6. 念白行：「念白：台词内容」（冒号后是完整句子）→ 歌词行；「念白 Narrator：人名」（冒号后是名字）→ credit 行
7. 判定辅助：冒号后是**完整句子**（句子成分完整、非人名/机构名形态）→ 不是 credit 行，是歌词行（如外语歌词 "Ah: si je pouvais vivre dans l'eau"）

【分类判定】
- 存在任何歌词行 → VOCAL；全部是 credit 行 → INSTRUMENTAL；无法判断 → unknown（confidence 给低分）

【输出要求】（严格 JSON，不要 markdown 代码块，不要任何其他文字）：
{"kind":"vocal|instrumental|unknown","confidence":0到1的小数,"clean_lyrics":"清洗后的LRC全文或null","credits":[{"role":"角色原文","names":["人名1","人名2"]}]}

【clean_lyrics 规则】
- 仅 kind=vocal 时输出：只含真实歌词行（保留 [mm:ss.xx] 时间戳），去掉标题行、credit 行、元数据头、占位行
- kind=instrumental 时 clean_lyrics=null

【credits 规则】
- 提取所有 credit 行：作曲/作词/编曲/演唱/乐器/录音师/录音棚/混音/母带/制作人/指挥/乐队/合唱等（含设施行、乐团名）
- 完整性：credits 必须覆盖 LRC 中出现的**所有** credit 行，不得遗漏（除下方不提取项）
- 不提取：**版权/厂牌标识行：「Music by xxx」「出品 Produced by：xxx」等 by 格式行和出品行（不是创作者信息）**；"©"、"版权所有"、"All rights reserved"、"(C)" 开头；元数据头、标题行、歌词行、占位声明行
- role = 「角色」部分原文（如 "作曲 Composer"），不翻译、不臆造、不改写
- names = 「人名」部分按明确分隔符（顿号/逗号/斜杠）拆分的个人列表；每个元素必须是**最小不可再分的实体**（人名/角色名/乐团/工作室名），不得再含冒号、职务词或分隔符；括号内容（含 "（CV：声优名）"，如 "温迪（CV：喵☆酱）"）作为名字的一部分整体保留
- 嵌套子职务（如 "独奏乐器 Solo Instruments：Guitar：xxx / Piano：yyy"）→ 按子职务拆成多行，role 取子职务（如 "Guitar"、"Piano"），names 为各子职务下的名字——每行保证「职务↔名字」一一对应
- **role 本身含多个平级职务**（如 "作曲/编曲"、"混音/母带 Mixing/Mastering Engineer"、"Mixing&Mastering"、"小号/富鲁格号 Trumpet/Flugelhorn"）→ 拆成多行，每行 role 取**单个职务**（中文按 / 、 & 顿号拆分、英文按 / & 拆分，中英配对；英文共享后缀如 "Mixing/Mastering Engineer" 拆为 "Mixing Engineer"+"Mastering Engineer"）；同一人的多个职务 = 多行
- **role 内不得残留冒号**（如 "录音师：Recording Engineer" 是错误的，应为 "录音师 Recording Engineer"）
- 空格不是人名分隔符："中文 拼音转写"（如 "车子玉 Ziyu Che"）视为同一人；仅当空格后是独立艺名/ID（非拼音，如 "张清 HaSu-P" 的 HaSu-P）才拆为不同人
- 人名保持 LRC 原文原样，不做任何删改（包括 @ 等符号）

【示例】
例1（vocal）：LRC 含 credit 行 "[00:01.00]作曲 Composer：苑迪萌 Dimeng Yuan (HOYO-MiX)" 和歌词行 "[00:22.31]啊，若化水复回归途" →
{"kind":"vocal","confidence":0.99,"clean_lyrics":"[00:22.31]啊，若化水复回归途","credits":[{"role":"作曲 Composer","names":["苑迪萌 Dimeng Yuan (HOYO-MiX)"]}]}
例2（instrumental）：LRC 全为 credit 行 "[00:02.42]作曲 Composer：罗静怡 Caroline Luo (HOYO-MiX)"、"[00:37.25]母带制作 Mastering Engineer：黄巍 Zach Huang" →
{"kind":"instrumental","confidence":0.98,"clean_lyrics":null,"credits":[{"role":"作曲 Composer","names":["罗静怡 Caroline Luo (HOYO-MiX)"]},{"role":"母带制作 Mastering Engineer","names":["黄巍 Zach Huang"]}]}
例3（占位）：LRC 全文仅 "[00:00.00]此歌曲为没有填词的纯音乐" →
{"kind":"instrumental","confidence":0.99,"clean_lyrics":null,"credits":[]}`;

// ── 系统提示词（仅抽取创作者，评估用）────────────────────────────
const EXTRACT_SYSTEM_PROMPT = `你是米哈游（HoYoVerse）游戏音乐 LRC 创作者信息提取器。从 LRC 中提取所有创作者/制作人员信息。

规则：
- 提取所有「角色：人名」格式的 credit 行：作曲/作词/编曲/演唱/乐器/录音师/录音棚/混音/母带/制作人/指挥/乐队/合唱等（含设施行如录音棚、乐团名）
- 完整性：credits 必须覆盖 LRC 中出现的**所有** credit 行，不得遗漏（除下方不提取项）
- 不提取：**版权/厂牌标识行：「Music by xxx」「出品 Produced by：xxx」等 by 格式行和出品行（不是创作者信息）**；"©"、"版权所有"、"All rights reserved"、"(C)" 开头；[ti:]/[ar:]/[al:] 等元数据头、标题行（"[mm:ss]歌名 - 厂牌"）、歌词行、占位声明行（"此歌曲为没有填词的纯音乐"）
- role 为「角色」部分原文（如 "作曲 Composer"），不翻译、不臆造、不改写
- names 为「人名」部分按明确分隔符（顿号/逗号/斜杠）拆分的个人列表；每个元素是**最小不可再分的实体**，不得再含冒号/职务词/分隔符，括号内容（含 "（CV：声优名）"）整体保留
- 若名字部分出现**嵌套子职务**（如 "独奏乐器 Solo Instruments：Guitar：xxx / Piano：yyy"），按子职务拆成多行，role 取子职务（如 "Guitar"、"Piano"），names 为各子职务下的名字——每行保证「职务↔名字」一一对应
- **role 本身含多个平级职务**（如 "作曲/编曲"、"混音/母带 Mixing/Mastering Engineer"、"Mixing&Mastering"、"小号/富鲁格号 Trumpet/Flugelhorn"）→ 拆成多行，每行 role 取**单个职务**（中文按 / 、 & 顿号拆分、英文按 / & 拆分，中英配对；英文共享后缀如 "Mixing/Mastering Engineer" 拆为 "Mixing Engineer"+"Mastering Engineer"）；同一人的多个职务 = 多行
- **role 内不得残留冒号**（如 "录音师：Recording Engineer" 是错误的，应为 "录音师 Recording Engineer"）
- 空格不是人名分隔符："中文 拼音转写"（如 "车子玉 Ziyu Che"）视为同一人；仅当空格后是独立艺名/ID（非拼音，如 "张清 HaSu-P" 的 HaSu-P）才拆为不同人
- 人名保持 LRC 原文原样，不做任何删改（包括 @ 等符号）
- confidence = 本次抽取的整体可信度（0-1 小数）：若 LRC 中 credit 行格式混乱/含歧义导致无法完全确定，给低分；格式规范且全部提取 → 高分
- 只输出 JSON，不要 markdown 代码块，不要任何解释文字

输出格式：{"confidence":0到1的小数,"credits":[{"role":"角色原文","names":["人名1","人名2"]}]}`;

/** 调用 OpenAI 兼容 chat/completions */
async function chat(messages: ChatMessage[]): Promise<string> {
  if (isMockMode()) {
    throw new Error('AI_API_KEY 未配置，处于 MOCK 模式，无法真实调用');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    const init: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages,
        temperature: 0,
        // max_tokens 必须覆盖 reasoning_content（思维链）+ content 两部分：
        // deepseek-v4-flash 对歧义 LRC 会输出超长思维链，8000 会被思维链吃光导致
        // content 为空或 JSON 截断（2026-08-06 根因定位）→ 32000
        max_tokens: 32000,
      }),
      signal: controller.signal,
    };
    if (dispatcher) {
      (init as Record<string, unknown>).dispatcher = dispatcher;
    }
    const res = await fetch(`${AI_BASE_URL}/chat/completions`, init);
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

/**
 * 修复常见 JSON 输出瑕疵（模型偶发）：
 * 1. 字符串内裸换行（模型把歌词多行直接写进字符串，未转义 \n）→ 替换为 \n 转义
 * 2. 未闭合字符串（如 clean_lyrics 末尾引号缺失）
 * 3. 尾随逗号（,} 或 ,]）
 * 修复失败返回 null
 */
function repairJson(raw: string): string | null {
  let t = raw;
  // ① 字符串内裸换行 → 转义（JSON 规范不允许字符串内真实换行）
  let out = '';
  let inStr = false;
  let esc = false;
  for (const c of t) {
    if (esc) {
      out += c;
      esc = false;
      continue;
    }
    if (inStr) {
      if (c === '\\') {
        out += c;
        esc = true;
        continue;
      }
      if (c === '"') {
        inStr = false;
      } else if (c === '\n' || c === '\r') {
        out += '\\n'; // 裸换行 → \n 转义
        continue;
      }
    } else if (c === '"') {
      inStr = true;
    }
    out += c;
  }
  t = out;
  // ② 尾随逗号
  t = t.replace(/,\s*([}\]])/g, '$1');
  try {
    JSON.parse(t);
    return t;
  } catch {
    /* continue */
  }
  // ③ 未闭合字符串：从后向前找第一个未配对的引号起点，截断到其内容末尾并补引号
  inStr = false;
  esc = false;
  let openIdx = -1;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (inStr) {
      if (c === '\\') {
        esc = true;
      } else if (c === '"') {
        inStr = false;
      }
    } else if (c === '"') {
      inStr = true;
      openIdx = i;
    }
  }
  if (inStr && openIdx >= 0) {
    const tail = t.slice(openIdx + 1);
    const cut = tail.search(/[,\}\]\n]/);
    const content = cut >= 0 ? tail.slice(0, cut) : tail;
    const fixed = t.slice(0, openIdx + 1) + content + '"';
    try {
      JSON.parse(fixed);
      return fixed;
    } catch {
      return null;
    }
  }
  return null;
}

/** 从模型输出中稳健提取 JSON（容忍 ```json 包裹、前后多余文字、常见输出瑕疵） */
function extractJson<T>(raw: string): T {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1].trim();
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first >= 0 && last > first) text = text.slice(first, last + 1);
  try {
    return JSON.parse(text) as T;
  } catch {
    const repaired = repairJson(text);
    if (repaired !== null) return JSON.parse(repaired) as T;
    throw new Error(`JSON 解析失败且修复失败: ${text.slice(0, 200)}`);
  }
}

/** 归一化模型返回的 credits 数组（仅结构归一，人名忠实保留原文） */
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

/** 仅抽取创作者信息（评估用），返回抽取结果 + 整体可信度 */
export async function extractCredits(lrcText: string): Promise<{ credits: CreditLine[]; confidence: number }> {
  const content = await chat([
    { role: 'system', content: EXTRACT_SYSTEM_PROMPT },
    { role: 'user', content: `请提取以下 LRC 的创作者信息：\n\n${lrcText}` },
  ]);
  const parsed = extractJson<{ credits?: unknown; confidence?: number }>(content);
  const confidence = Math.min(1, Math.max(0, Number(parsed.confidence) || 0));
  return { credits: normalizeCredits(parsed.credits), confidence };
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
