/**
 * extractLrcCreators.ts
 * 从 .lrc 文件抽取创作者/制作信息（角色 + 名字），对齐到 track_credits 模型。
 *
 * 设计原则（与项目铁律一致）：
 * - 默认 --dry-run：只读文件 + 打印抽取结果，不碰数据库。
 * - 抽取逻辑是纯函数，可复现、不臆造：解析不到就留空，绝不编造角色或名字。
 * - DB 写入（apply）需显式 --apply 且调用方已确认 + 备份，本脚本默认不写。
 *
 * ⚠️ 角色忠实原则（2026-07-13 用户拍板）：
 * - **credit_key 恒等于 lrc 原文角色文本（roleRaw）**，这是唯一真值。lrc 里写什么角色就记什么角色。
 * - ROLE_ALIASES 仅是「可选归一化标签」（把 作曲/曲/谱曲 → composer 便于聚合/多语），
 *   **绝不作为过滤器**：映射不到就 roleCanonical=null，但该 credit 照常忠实记录，绝不丢弃、绝不标 unknown。
 * - 双语角色整条存（如「作曲 Composer」），不拆中英文（2026-07-13 21:20 拍板）。
 *
 * ⚠️ 单值化原则（2026-07-13 用户拍板，DB 写入约束）：
 * - **DB 每一行 = 一个角色 + 一个名字，全部单值、一一对应，不允许多值。**
 * - 组合必须合理拆开：
 *     · 角色按 `&`/`、`/`/` 拆（冒号前；含「一人多职/多乐器」如 ZZZ「作曲/编曲」、GI「印第安笛/盖那笛/陶笛」）；
 *   - 名字按 `/`、`、`、`,`、`，`、`；` 拆（冒号后，如「A/B」→ 两行）。
 *   - 角色与名字在不同字段（冒号前/后）分别切分，互不干扰。
 * - 拆分只切并列标记、不猜语义，不违背「不臆造」。
 * - 前端把多行合并展示（拼回「和声编写&和声：鱼椒盐」）是另一码事，不污染底层单值行。
 *
 * ⚠️ 名字存法（2026-07-13 21:20 用户拍板，对 GI/HSR/ToT/ZZZ 全量语料实证）：
 * - **名字整体存**，包括：
 *     · 双语名「陈致逸 Yu-Peng Chen」整条存，不拆中英文；
 *     · 工作室括号「崔瀚普TSAR (HOYO-MiX)」**保留不剥**；
 *     · CV 配音括号「温迪（CV：喵☆酱）」整体当一个名字存（角色扮演者=游戏角色，声优是其内部信息，抽取层不解析）；
 *     · 同一人有时带工作室括号、有时不带（如「崔瀚普TSAR」vs「崔瀚普TSAR (HOYO-MiX)」）→ **两个都原样保留、不归一**。
 * - 「英文名相似但不同」的去重归一化是**下游任务**（artists 表匹配），不在抽取层做。
 *
 * 用法：
 *   npx ts-node scripts/lyricsCreators/extractLrcCreators.ts --dir <lrc目录> [--json]
 *   npx ts-node scripts/lyricsCreators/extractLrcCreators.ts --file <单个.lrc>
 *
 * 2026-07-14 修复批次（全量逐文件目读实证，bug A–V）：
 *   A/C 头标签泄漏 → 非 ti/ar/al 的 [xxx:...] 整行跳过
 *   I   @工作室后缀 → 从名字提取到 studio 字段（兼容 `@X` / `@ X` 两种写法），不再剥丢/残留
 *   K   HTML 实体 → readFileSmart 解码（&#NNN; / &amp; 等 → 字符，不碰裸 &）
 *   T   全角分号 → splitNames 增加 ； ;
 *   D   前导冒号 → normalizeName 剥掉名字前导 ：
 *   E   角色侧 & → 从 splitRoles 移除（Mixing&Master Engineer 是合并职位）
 *   H   角色侧 / → 仅当各段都不含英文时才拆（双语角色不拆）
 *   J   独立 CV 行 → 整串当一个名字，不在冒号处切
 *   M   歌词全角冒号 → 纯中文长角色(>5)当歌词排除
 *   B/B2/G 跨行续接 → pendingRole(role-only 行) + lastCredit 多行友好角色续接
 *         续行护栏 canContinue：伴奏曲/正文歌词行（拉丁句读/拟声重复/中日文句读/纯中文短语）
 *         不得误当 credit 续行值（修复「制作人后整段歌词被记成 50+ 条 [制作人]」回归）。
 *   J   独立 CV 行 → 整串当一个名字；但处于角色挂起续行中时不触发（合唱名单归因到合唱角色）。
 *   Q   空 ti → 用文件名兜底并标 titleSource=filename
 *   L   误标(鱼) → titleSource=suspect 标记待核
 */

import fs from 'fs';
import path from 'path';
import iconv from 'iconv-lite';

/** 中文/惯用角色别名 → 规范角色键。按需扩展。 */
const ROLE_ALIASES: Record<string, string> = {
  演唱: 'vocal', 主唱: 'vocal', 歌: 'vocal', 独唱: 'vocal', 合唱: 'vocal',
  作曲: 'composer', 曲: 'composer', 谱曲: 'composer',
  作词: 'lyricist', 词: 'lyricist', 填词: 'lyricist',
  编曲: 'arranger', 编: 'arranger', 配器: 'arranger',
  制作人: 'producer', 制作: 'producer', 出品: 'producer',
  混音: 'mixing', 混音母带: 'mastering', 母带: 'mastering',
  弦乐: 'strings', 弦乐编写: 'strings_arrangement', 弦乐监制: 'strings_supervision',
  和声: 'harmony', 和声编写: 'harmony_arrangement',
  钢琴: 'piano', 吉他: 'guitar', 贝斯: 'bass', 鼓: 'drums',
  录音: 'recording', 主唱录音: 'vocal_recording', 弦乐录音: 'strings_recording',
  音乐编辑: 'music_editing', 制作统筹: 'production_coordination',
  编写: 'arrangement', 监制: 'supervisor', 配音: 'voice', 旁白: 'narration',
  // BUG #1: 无冒号 "Music by X" 等整行 → 归一（roleRaw 仍忠实记原文名词）
  Music: 'composer', music: 'composer', Song: 'composer', song: 'composer',
  Composed: 'composer', composed: 'composer',
  Lyrics: 'lyricist', lyrics: 'lyricist', Words: 'lyricist', words: 'lyricist',
  Written: 'lyricist', written: 'lyricist',
  Arranged: 'arranger', arranged: 'arranger',
  Orchestrated: 'arranger', orchestrated: 'arranger',
  Produced: 'producer', produced: 'producer',
  Performed: 'vocal', performed: 'vocal',
};

/** 单值化后的创作者条目：一行 = 一个角色 + 一个名字。 */
export interface FlatCredit {
  roleRaw: string;
  roleCanonical: string | null;
  name: string;
  studio?: string | null;
}

export interface LrcParse {
  title: string | null;
  album: string | null;
  titleSource?: 'lrc' | 'filename' | 'suspect';
  credits: FlatCredit[];
}

/** 源缺陷补全（用户拍板 #1「括号补全」）：源文件缺/错配的括号补全。
 * 仅处理明显不平衡：① 全角开缺全角闭 → 补 ；② 半角开缺半角闭 → 补 )；
 * ③ 半角开配全角闭（如 `(HOYO-MiX）`）→ 把全角闭归一为半角 )。
 * 本就平衡的串（含 CV 注解 `温迪（CV：喵☆酱）`）原样不动。 */
function balanceBrackets(s: string): string {
  let out = s;
  const op = (out.match(/\(/g) || []).length;
  const cl = (out.match(/\)/g) || []).length;
  const opF = (out.match(/（/g) || []).length;
  const clF = (out.match(/）/g) || []).length;
  // 半角开 + 全角闭 → 归一为半角闭
  if (op > 0 && opF === 0 && cl === 0 && clF > 0) {
    return out.replace(/）/g, ')');
  }
  // 全角开 + 半角闭 → 归一为全角闭
  if (opF > 0 && op === 0 && clF === 0 && cl > 0) {
    return out.replace(/\)/g, '）');
  }
  if (opF > clF) out += '）'.repeat(opF - clF); // 缺全角闭
  if (op > cl) out += ')'.repeat(op - cl); // 缺半角闭
  return out;
}

/** 收尾空格 + 前导冒号(:/：) + 括号补全。不再剥离 @（工作室后缀改由 splitNames 提取到 studio 字段）。 */
function normalizeName(n: string): string {
  return balanceBrackets(n.replace(/\s+/g, ' ').trim().replace(/^[：:]+/, ''));
}

/** 工作室/录音棚信号：续行文本含这些词才视为「工作室值续行」（修复续行误抓歌词回归的关键）。 */
const STUDIO_KW = /Studio|STUDIO|录音棚|工作室|录音师|录音|混音|母带|制谱|株式会社/i;

/** 团体/工作室实体关键词：纯中文长串若含这些词，则是「合唱团/乐团/录音棚」等专有名词（如 深空合唱团、国际首席爱乐乐团、上海升赫录音棚），
 * 不是歌词。用于在 looksLikeLyricName 中豁免「纯中文>4 → 歌词」的过激规则，避免把团体/工作室名当歌词丢弃（HSR 童声合唱 / ZZZ 乐团 类遗漏）。 */
const ENTITY_KW = /合唱团|合唱队|爱乐|交响|乐团|乐队|工作室|录音棚|录音室|歌剧院|音乐团|艺术团|室内乐|国乐|民乐|管弦乐|管乐团|打击乐团|少儿|童声|少年|女子|男子|混声|合唱|声乐|演奏团/i;

/** 段标题/非 credit 标签（如「歌词大意」「翻译」「罗马音」）：整体是歌词区块标题，
 * 其后紧跟的是歌词行，绝不能当角色挂起或名字。 */
const SECTION_TITLE_KW = /^(歌词大意|歌词翻译|翻译|罗马音|罗马拼音|译文|歌词|拼音|注音|注)$/;

/** 续行护栏：当前裸行是否「像歌词」而不应作为 credit 续行值。
 * 触发场景：修复 B/B2/G 续行逻辑把伴奏曲/正文歌词误抓为 credit 的回归
 * （如「制作人 Producer：崔瀚普」后整段英文歌词被记成 50+ 条 [制作人]）。
 * 排除信号（这些不是歌词）：CV 名单行、工作室行。 */
function looksLikeLyric(text: string): boolean {
  if (/[（(]CV/i.test(text)) return false; // CV 名单行（合唱成员等）→ 不是歌词
  if (STUDIO_KW.test(text)) return false; // 工作室/录音棚行 → 不是歌词
  if (/[.,;!?~—…]/.test(text)) return true; // 拉丁句读/标点
  if (/\b[a-z]+'/i.test(text)) return true; // 英文缩写/所有格（poppin' / callin' / tickin'）
  if (/[，。、？！——…・]/.test(text)) return true; // 中日文句读
  if (/[ぁ-んァ-ヶ]/.test(text)) return true; // 日文假名 → 歌词
  // 英文短语（≥2 拉丁词，或含小写的单词）→ 歌词（英文名字一般在 role:name 行，不在续行）
  const latToks = text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t.toLowerCase().replace(/[^a-z]/g, ''))
    .filter((t) => /[a-z]/.test(t));
  if (latToks.length >= 2) return true;
  if (latToks.length === 1 && /[a-z]/.test(text)) return true;
  return false;
}

/** 续行护栏（中文）：纯中文且无角色/工作室信号、较长 → 视为歌词短语，不当续行。
 * 中文名字通常 ≤4 字；较长纯中文串多为歌词/诗句（如「当你走上回家的路」）。 */
function isLyricPhraseCJK(text: string): boolean {
  if (!/^[一-鿿\s（）：:]+$/.test(text)) return false; // 含拉丁/数字/假名 → 交给 looksLikeLyric
  if (text.length <= 4) return false; // 短中文多为名字
  if (STUDIO_KW.test(text)) return false; // 含工作室信号
  return true;
}

/** 续行总护栏：通过则不视为歌词，可作 credit 续行值。 */
function canContinue(text: string): boolean {
  if (/[。！？!?]/.test(text)) return false;
  if (text.length >= 50) return false;
  if (looksLikeLyric(text)) return false;
  if (isLyricPhraseCJK(text)) return false;
  return true;
}

/** BUG #3 / #6 辅助：role 段是否像「歌词角色」（应丢弃，不当 credit）。 */
function looksLikeLyricRole(rt: string): boolean {
  if (/^[（(]/.test(rt)) return true; // 仅「开头」括号 = 歌词注释（如「（Re」）；中间括号是角色修饰（如 编曲（电子）），不当歌词
  const lat = rt.split(/\s+/).filter((t) => /[A-Za-z]/.test(t));
  // BUG #3/#5 修复：仅「纯拉丁」≥4 词短语才判歌词（如 "Ewig wird es sein"）。
  // 含中文的双语长角色（如「伴奏混音母带 Backing Mix Mastering Engineer」、
  //「印第安笛 Native American Flute / 盖那笛 Quena / 陶笛 Ocarina」）绝不判歌词，否则整条被误丢。
  if (lat.length >= 4 && !/[一-鿿]/.test(rt)) return true;
  if (/^[一-鿿]+$/.test(rt) && rt.length > 6) return true; // 纯中文长串(>6)更像歌词短语而非角色
  return false; // 去掉原先 rt.length>30 的过激规则（双语角色如 "Scoring Sessions Director" 会被误杀）
}

/** BUG #3 / #6 辅助：name 段是否像「歌词」（整条 credit 应丢弃）。 */
function looksLikeLyricName(nm: string): boolean {
  if (/[。！？]/.test(nm)) return true; // 句末标点(全角) → 歌词；半角 !? 常见于工作室名(如 Ready Steady Sound!)，不计入
  if (/^[一-鿿]+$/.test(nm) && nm.length > 4) {
    // 含团体/工作室实体关键词的纯中文长串是「专有名词」而非歌词（如 深空合唱团、国际首席爱乐乐团）
    if (ENTITY_KW.test(nm)) return false;
    return true; // 纯中文长串(>4)且无实体关键词 → 歌词短语，不是人名
  }
  return false;
}

/** BUG #5 辅助：续行文本是否像「credit 值」（人名/工作室），而非歌词。
 * 与 canContinue 不同：canContinue 把单个拉丁词(如 SoundCity/Anzol)当歌词误拒；
 * 这里对「人名/工作室」更宽容，但仍拒纯中文短串(可能为歌词)与长拉丁句。 */
function isContinuationValue(text: string): boolean {
  if (/[。！？!?]/.test(text)) return false; // 句末标点 → 歌词
  if (text.length > 40) return false; // 过长 → 非名字
  if (/[、；;]\s*$/.test(text)) return true; // 尾随枚举/分号分隔符 → 续行项（不含中文逗号「，」：那是歌词行特征，会误抓诗句）
  if (STUDIO_KW.test(text)) return true; // 含工作室信号
  if (/[（(]/.test(text)) return true; // 含括号(工作室/角色注解)
  const toks = text.split(/\s+/).filter(Boolean);
  const lat = toks.filter((t) => /[A-Za-z]/.test(t));
  if (lat.length === 1) return true; // 单个拉丁词(如 SoundCity/Anzol) → 工作室名
  if (lat.length >= 2 && lat.length <= 3 &&
      lat.some((t) => /^[A-Z]/.test(t) || t.includes('.'))) return true; // 罗马化人名
  return false; // 长拉丁句 / 纯中文短串(可能为歌词) → 否
}

/** 公司/场馆/乐团英文标志词：续行文本含这些词 → 确为工作室/团体/人名注解（非歌词）。 */
const ORG_KW = /\b(Records?|Recording|Studios?|Hall|Orchestra|Ensemble|Choir|Philharmonic|Quartet|Quintet|Inc|Ltd|Co|Company|Soundhub|SoundCity)\b/i;

/**
 * BUG #1/#2 核心修复：严格续行判定。
 * 只有「明确的 credit 值」才作为上一条 credit 的续行值；否则一律当歌词丢弃。
 * 判定信号（满足其一即续行）：
 *   ① prevEndedWithSep：上一行值以 / 、 结尾 → 本行必为续行（模式 B：合唱/录音棚跨行名单）；
 *   ② 含工作室/录音棚/团体关键词（STUDIO_KW/ENTITY_KW/ORG_KW/株式会社/音乐厅…）→ 工作室/团体名（模式 A）；
 *   ③ 单个拉丁 CamelCase 词（如 SoundCity）→ 工作室名。
 * 其余（英文/中文歌词、含标点、无信号行）→ 不续接（彻底堵住歌词误抓）。
 * 注意：不再用「2-3 词首字母大写 → 罗马名」「单拉丁词 → 工作室」「含括号 → 工作室」这些过宽规则，
 *       它们正是把 "Nothing to fear" / "How long" / "(So where do we go)" 等歌词误抓为 credit 的根源。
 */
function strongContinuation(text: string, prevEndedWithSep: boolean): boolean {
  if (/[。！？!?]/.test(text)) return false; // 句末标点 → 歌词
  if (text.length > 80) return false; // 过长 → 非续行值
  if (prevEndedWithSep) return true; // 显式续行信号（最强）：上一行以 / 、 结尾
  if (STUDIO_KW.test(text) || ENTITY_KW.test(text) || ORG_KW.test(text)) return true;
  if (/株式会社|音乐厅|音樂廳|歌剧院|音乐学院|音樂學院/.test(text)) return true;
  const toks = text.split(/\s+/).filter(Boolean);
  if (toks.length === 1 && /^[A-Za-z][a-z]+[A-Z][A-Za-z]*$/.test(toks[0])) return true; // CamelCase 工作室名 (SoundCity)
  // 多词「每词首字母大写」的拉丁名/场馆（如 "Tokyo Opera City Concert Hall"、"Dan Blessinger"）。
  // 不含小写开头的功能词（and/of/the）、不以 !? 结尾，与歌词短语区分（歌词多为 "How long"/"Now" 形态）。
  if (toks.length >= 2 && toks.length <= 6 &&
      toks.every((t) => /^[A-Z][A-Za-z]+$/.test(t.replace(/[(),.]/g, ''))) &&
      !/[a-z]/.test(text)) return true;
  return false;
}

/** 角色文本是否「已知角色」（含双语，如「演唱 Vocal」取中文部分再判）。
 * 用于放行「已知角色：纯中文长人名」（如 演唱：加藤里保菜、作曲：时空储蓄罐），
 * 避免 looksLikeLyricName 的「纯中文>4→歌词」规则误杀真人名（BUG #4）。 */
function roleLooksKnown(rt: string): boolean {
  if (isKnownRole(rt)) return true;
  const cjkOnly = rt.replace(/[^\u4e00-\u9fff、\/]/g, '').trim();
  if (cjkOnly && isKnownRole(cjkOnly)) return true;
  return false;
}

/** 源缺陷补全（用户拍板 #3「应拆尽拆」，谨慎判断）：
 * 仅当某「中文 token」被拉丁 token 夹在中间（前后都是拉丁、且自身不在括号注解内）时，
 * 该中文是独立实体边界，在其前拆分。精确拆出：
 *   - 「中文名 拼音 中文名 拼音」双人（#0596 黄巍/王小四、#0601 莫家伟/王小四）；
 *   - 「英文工作室 中文工作室 英文工作室」双棚（#0033 Heartbeat/金田、潸怅的幽影 52Hz/上海广播大厦）。
 * 明确【不拆】避免误拆（谨慎判断）：
 *   - 夹心中文在 `（` 注解内（如 `丁子涵 Zihan Ding（亚洲爱乐乐团…）` 是一人 + 合唱团注解，Ding 非独立人）；
 *   - 左侧纯拉丁是「角色词」而非工作室（如 `Recording Engineer 满家豪 Jiahao Man` 中 Recording Engineer 是角色残留，非第二人）。
 * 单个人名（`Linnea Nea Södahl and Adam Von Mentze`、`Cristina Vassallo`、`Masaki Mori (agehasprings)`）无夹心中文 → 不拆。 */
function isCjkTok(t: string): boolean {
  return /[一-鿿]/.test(t);
}
const STUDIO_NAME_KW = /Studio|STUDIO|录音棚|工作室|录音室/;
function splitSpaceJoined(s: string): string[] {
  const parts = [s];
  let changed = true;
  let guard = 0;
  while (changed && guard++ < 10) {
    changed = false;
    for (let i = 0; i < parts.length; i++) {
      const toks = parts[i].split(/\s+/).filter(Boolean);
      if (toks.length < 3) continue;
      for (let j = 1; j < toks.length - 1; j++) {
        const t = toks[j];
        if (!isCjkTok(t)) continue; // 非中文 token
        if (t.includes('（')) continue; // 括号内中文 = 注解（如 `Ding（亚洲爱乐乐团…）`），非独立实体
        // 必须严格「夹在拉丁之间」：左右紧邻 token 都非中文
        if (isCjkTok(toks[j - 1]) || isCjkTok(toks[j + 1])) continue;
        const left = toks.slice(0, j).join(' ');
        const right = toks.slice(j).join(' ');
        const doSplit =
          STUDIO_NAME_KW.test(t) || // 夹心中文本身是录音棚/工作室 → 双棚
          STUDIO_NAME_KW.test(left) || // 左侧纯拉丁但确为工作室（Heartbeat Recording Studio / 52Hz Studio）→ 双棚
          (isCjkTok(left) && isCjkTok(right)); // 两侧都是「中文+拼音」双语人名 → 双人
        if (doSplit) {
          parts.splice(i, 1, left, right);
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
  }
  return parts;
}

/** 按 / 、 , ， ； ; 切分多个名字（冒号后字段专用）。
 * 同时把末尾的 @工作室 后缀提取到 studio 字段（兼容 `@X` 与 `@ X` 两种写法）。
 * 并做空格连写「应拆尽拆」（splitSpaceJoined）。 */
function splitNames(s: string): { name: string; studio: string | null }[] {
  return s
    .split(/[／/、,，；;]/)
    .map((raw) => {
      const m = raw.match(/^(.*?)\s*@\s*(.+)$/);
      const name = normalizeName(m ? m[1] : raw);
      const studio = m ? m[2].trim() : null;
      return { name, studio };
    })
    .flatMap((x) => {
      if (!x.name) return [];
      return splitSpaceJoined(x.name).map((nm) => ({ name: nm, studio: x.studio }));
    });
}

/** 某段是否为「完整双语乐器/角色标签」（中文 + 英文成对，如「琵琶 Pipa」「印第安笛 Native American Flute」）。 */
function isBilingualSeg(seg: string): boolean {
  return /[一-鿿]/.test(seg) && /[A-Za-z]/.test(seg);
}

/** 按 、 / 切分组合角色（冒号前字段专用）。
 *  - / 当「每段都是完整双语标签」时拆（用户 q-0 拍板：组合乐器如「琵琶 Pipa/大阮 Daruan」「印第安笛 Native American Flute / 盖那笛 Quena」拆成多条，各带同一名）；
 *  - / 当「整串才是双语角色、并非每段成对」时整串保留（如「小号/富鲁格号 Trumpet/Flugelhorn」→ 整串，避免拆出孤立英文段）；
 *  - 、 仅当「各段都不含英文」才拆（一人多职/多乐器如 ZZZ「作曲/编曲」、GI「印第安笛/陶笛」）；含英文则整串保留。
 *  & 已从拆分中移除（Mixing&Master Engineer 是合并职位，不是两个人）。 */
function splitRoles(s: string): string[] {
  const out: string[] = [];
  for (const clause of s.split(/[、]/)) {
    const segs = clause.split('/');
    if (segs.length > 1) {
      if (segs.every(isBilingualSeg)) {
        for (const seg of segs) {
          const t = seg.trim();
          if (t) out.push(t);
        }
      } else {
        out.push(clause.trim());
      }
    } else {
      const t = clause.trim();
      if (t) out.push(t);
    }
  }
  return out;
}

/**
 * 解析单个「角色：名字」文本，展开成单值 FlatCredit 列表。
 * 角色按 、/ 拆，名字按 /、,； 拆，笛卡尔积即所有单值 (角色,名字) 对。
 */
/** 推送一条单值 credit（带 (角色,名字) 去重）。 */
function pushPair(
  role: string,
  canon: string | null,
  n: { name: string; studio: string | null },
  push: (c: FlatCredit) => void,
  seen: Set<string>,
): void {
  if (!role || !n.name) return;
  const sig = `${role}|${n.name}`;
  if (seen.has(sig)) return;
  seen.add(sig);
  push({ roleRaw: role, roleCanonical: canon, name: n.name, studio: n.studio ?? undefined });
}

/**
 * 解析「角色：值」文本 → 单值 credit 列表。
 * BUG #4 修复：值可能是「SubRole：SubName」列表（如「钢琴：X，二胡、高胡：Y」），
 * 此时 SubRole 成为真实角色（兼容 / 、 多乐器共享一名），而非把整串塞进 name。
 * 主分隔符用 、，；;（全角逗号/分号）；、 仅用于 SubRole 内部多乐器连接，
 * 不再作为顶层分隔符误拆「二胡、高胡：Y」→ 避免「二胡」变孤儿名。
 */

/** 冒号前段是否像「已知角色」（用于嵌套冒号拆子角色的判断，避免把子组名误当角色）。 */
function isKnownRole(s: string): boolean {
  return splitRoles(s).every((seg) => ROLE_ALIASES[seg] != null);
}

/** 「容器角色」：其值本身是一串「子乐器：演奏者」清单（如 独奏乐器 Solo Instruments）。
 * 此类角色下，冒号前段（子乐器）即真实角色，即使不在 ROLE_ALIASES 中也应展开，
 * 否则子乐器前缀会泄漏进 name（如 name='synth：Yoonhee kim'、琵琶丢名）。 */
function isContainerRole(roleRaw: string): boolean {
  const t = roleRaw.trim();
  return /^独奏乐器(\s+Solo\s+Instruments)?$/.test(t) || /^Solo\s+Instruments$/i.test(t);
}

/** 容器角色内的子乐器切分：一律按 / 、 拆（每段=一件乐器，可共享同一演奏者）。
 * 与通用 splitRoles 不同：这里 / 对纯中文（琵琶/中阮）或纯英文（Piano/synth）也拆，
 * 因为容器语境下 / 明确是「多乐器共享一名」而非双语标签。 */
function splitContainerSubRoles(s: string): string[] {
  return s
    .split(/[/／、]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** 第12类修复：role 段的前导中文段若本身已是「已知角色」（如 演唱/作曲/作词/编曲…），
 * 则该 `角色：名字` 行必然是真实 credit，名字段**不应**被 looksLikeLyricName 的长中文>4规则误杀
 * （否则 ZZZ 纯中文人名「长谷川育美」「时空储蓄罐」等会被当歌词丢弃）。 */
function leadingCjkIsKnownRole(rt: string): boolean {
  const cjk = rt.replace(/[^一-鿿]/g, '');
  return cjk.length > 0 && ROLE_ALIASES[cjk] != null;
}

function expandCredit(
  roleRaw: string,
  valueStr: string,
  push: (c: FlatCredit) => void,
  seen: Set<string>,
): void {
  const roles = splitRoles(roleRaw);
  if (roles.length === 0) return;
  const container = isContainerRole(roleRaw);
  const items = valueStr
    .split(/[，；;]/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const item of items) {
    const colon = item.match(/^(.+?)[：:]\s*(.+)$/);
    // 仅当冒号「前段」不含括号时才视为嵌套 SubRole：SubName。
    // 否则（如 CV 注解 `温迪（CV：喵☆酱）`）冒号是「名字内的注解」，并非子角色分隔符，
    // 须整体当名字（与 BUG J 拍板一致），否则会把 `温迪（CV` 误拆成角色。
    // 嵌套 SubRole：SubName 展开（冒号前段不含括号即视为子角色）。
    // - 括号守卫：保护 CV 注解 `温迪（CV：喵☆酱）` 整体当名字（BUG J 拍板）。
    // - 容器角色（独奏乐器 Solo Instruments）：子乐器 / 、 都切分，共享同一演奏者。
    // - 其余情形：源自带的子分组标注（第一合唱1st Choir、弦乐录制）提升为角色，
    //   清晰分离 role/name、不丢信息、不臆造（全量已证仅 2 例非 CV、非容器）。
    if (colon && !/[（(]/.test(colon[1])) {
      const subRoles = container
        ? splitContainerSubRoles(colon[1].trim())
        : splitRoles(colon[1].trim());
      const subNameStr = colon[2].trim();
      for (const sr of subRoles) {
        const canon = ROLE_ALIASES[sr] || null;
        for (const n of splitNames(subNameStr)) pushPair(sr, canon, n, push, seen);
      }
    } else {
      // 纯名字列表（可能含 / 、 多名字；或含括号注解如 CV 的名字）
      for (const r of roles) {
        const canon = ROLE_ALIASES[r] || null;
        for (const n of splitNames(item)) pushPair(r, canon, n, push, seen);
      }
    }
  }
}

export function parseLrc(content: string): LrcParse {
  const lines = content.split(/\r?\n/);
  const result: LrcParse = { title: null, album: null, credits: [] };
  const seen = new Set<string>();

  let pendingRole: string | null = null; // 来自「只有角色、名字为空」的行，等续行补名字
  // BUG #1/#2 续行状态：上一行「值」是否以 / 、 结尾（跨行名单的显式续行信号）。
  let prevEndedWithSep = false;

  const pushCredit = (c: FlatCredit) => {
    result.credits.push(c);
  };

  for (const line of lines) {
    // 快照上一行的续行信号；本行默认「不贡献续行」（非 credit 行→false），
    // 仅在真正产出 credit 的分支里根据本行末尾是否 / 、 覆写。
    const prevSep = prevEndedWithSep;
    prevEndedWithSep = false;
    // 头部标签 [ti:..] [ar:..] [al:..]
    const hdr = line.match(/^\[(ti|ar|al):(.*)\]\s*$/);
    if (hdr) {
      const key = hdr[1];
      const val = hdr[2].trim();
      if (key === 'ti') result.title = val;
      else if (key === 'al') result.album = val;
      // [ar:...] 艺人/表演者字段：按用户拍板(20:45)忽略，不纳入创作者抽取
      // （与正文角色重复，且对创作者归属无意义）。
      pendingRole = null;
      continue;
    }

    // BUG A/C: 其他方括号头标签([by:]/[offset:0]/[kana:]等)整行跳过，不当 credit
    if (/^\[[a-zA-Z]+:.*\]$/.test(line)) {
      pendingRole = null;
      continue;
    }

    // 抽取文本：时间轴行取 ] 之后；非时间轴行（如伴奏曲把 credit 写成纯文本行，
    // 无 [00:00.00] 前缀）取整行 —— 两类都可能是真 credit，不能因无时间码而静默跳过。
    const body = line.match(/^\[\d+:\d+\.\d+\](.*)$/);
    let text = (body ? body[1] : line).trim();
    // 行首装饰性项目符号（·•・）剥离，避免污染 roleRaw（如 `·作曲 Composer` → `作曲 Composer`）。
    text = text.replace(/^[·•・]+\s*/, '');
    if (!text) {
      pendingRole = null;
      continue;
    }

    // 标题行排除（歌曲标题/副标题，并非「角色：名字」结构），用精确标题特征判别，
    // 避免粗糙守卫误杀名字里含「 - 」的真 credit（如「Spela Gorogranc - Shana」）：
    //  · 含书名号《》；
    //  · 含「角色演示 / PV曲 / EP专辑 / 动画 / 演示」等标题标记；
    //  · 名字段（第一个冒号之后）含半角冒号「:」→「中文歌名：英文歌名」标题结构；
    //  · 含「 - HOYO-MiX」（HOYO-MiX 出品署名，标题行特征）。
    if (/[《》]/.test(text)) { pendingRole = null; continue; }
    if (/角色演示|PV曲|EP专辑|动画|演示/.test(text)) { pendingRole = null; continue; }
    if (/[-–—]\s*HOYO-MiX/i.test(text)) { pendingRole = null; continue; }
    if (text.replace(/^.+?[：:]/, '').includes(':')) { pendingRole = null; continue; }

    // 整行被外层成对括号包裹的 credit（如「（合唱作词：陈粒 Chen Li/三宝 Bao）」）：
    // 仅当整行以 （ 开头、） 结尾时剥离最外层；内层括号（如 编曲（电子））一律保留。
    if (text.startsWith('（') && text.endsWith('）')) {
      text = text.slice(1, -1).trim();
    }

    // BUG J: CV 名单行（冒号只出现在 CV 之后，前置无角色冒号）→ 整串当一个名字。
    //  · 若正处于「角色挂起续行」中（如合唱名单 `派蒙（CV：多多）` 在 `伙伴合唱 Chorus：` 下），
    //    则归因到挂起角色（合唱），且【不重置 pendingRole】，使后续成员持续归属同一角色；
    //  · 否则（独立 CV 行）记为「配音」角色。
    //  注意：名字内的 `（CV：声优）` 不被当作 role:name 分隔符（roleMatch 会因内嵌 ： 误拆），故在此优先处理。
    const cvIdx = text.search(/[（(]CV/i);
    if (cvIdx >= 0 && !/[：:]/.test(text.slice(0, cvIdx))) {
      const nm = normalizeName(text);
      if (nm) {
        if (pendingRole) {
          expandCredit(pendingRole, nm, pushCredit, seen);
        } else {
          pushCredit({ roleRaw: '配音', roleCanonical: 'voice', name: nm });
          pendingRole = null;
        }
      }
      continue;
    }

    // BUG #1: 无冒号「Music by X」「Lyrics by X」整行（ToT 未定事件簿 37 文件常见）。
    // 之前因无冒号被漏抓。roleRaw 忠实记原文名词（如 "Music"），canon 经 ROLE_ALIASES 归一。
    const byMatch = text.match(/^(music|lyrics|words|composed|arranged|written|produced|song|orchestrated|performed)\s+by\s+(.+)$/i);
    if (byMatch) {
      const nameText = byMatch[2].trim();
      expandCredit(byMatch[1], nameText, pushCredit, seen);
      pendingRole = null;
      continue;
    }

    // 角色-only 行（冒号后无名字，如「伙伴合唱 Chorus：」）→ 挂起 pendingRole，等续行补名字
    const roleOnly = text.match(/^(.+?)[：:]\s*$/);
    if (roleOnly) {
      const rt = roleOnly[1].trim();
      // BUG #3: role 段像歌词（拉丁短语/括号注释，如 "Ewig wird es sein" / "（Re"）→ 不当 pendingRole
      if (looksLikeLyricRole(rt)) {
        pendingRole = null;
        continue;
      }
      // 续行护栏：角色文本含日文假名、或不含任何中日文/拉丁（纯符号/假名）→ 不是真实角色，跳过
      // （如日文歌词行「おすすめは：」误当角色，导致后续歌词被记成其续行）
      if (/[ぁ-んァ-ヶ]/.test(rt) || !/[一-鿿A-Za-z]/.test(rt)) {
        pendingRole = null;
        continue;
      }
      pendingRole = rt;
      continue;
    }

    // 角色：名字 模式（兼容全角/半角冒号；双语角色/名字整体存，不拆）
    const roleMatch = text.match(/^(.+?)[：:]\s*(.+)$/);
    if (roleMatch) {
      const roleText = roleMatch[1].trim();
      const nameText = roleMatch[2];
      // BUG #2: 歌词声部标记 T/S/A/B/W/M（及男女声等）不是 credit，跳过
      // （拉丁合唱曲用 `T: ...` / `W: ...` 标声部，其后为歌词而非创作者）
      if (/^(w|m|t|s|a|b|men|women|男|女|男声|女声|童声|合唱队)$/i.test(roleText)) {
        pendingRole = null;
        continue;
      }
      // BUG #3 / #6: role 段或 name 段像歌词（如 "Ewig wird es sein" / "（Re" / 长中文短语）→ 丢弃，
      // 同时不再因「纯中文长角色>5」误丢合法角色（如 和声音频编辑）。
      // BUG #4 修复：当 role 是「已知角色」（如 作曲/演唱/钢琴）时，不再用 looksLikeLyricName
      //   的「纯中文>4→歌词」规则误杀真人名（如 作曲：时空储蓄罐、演唱：加藤里保菜/长谷川大祐）。
      if (looksLikeLyricRole(roleText) || (!roleLooksKnown(roleText) && looksLikeLyricName(nameText))) {
        pendingRole = null;
        continue;
      }
      expandCredit(roleText, nameText, pushCredit, seen);
      pendingRole = null;
      prevEndedWithSep = /[\/／、]\s*$/.test(text); // 本行值以 / 、 结尾 → 下一行是续行名单
      continue;
    }

    // BUG B/B2/G: 无冒号续行 → 归因到 pendingRole（角色挂起行，如合唱名单）。
    // 续行前必须过歌词护栏：显式续行(prevSep)直接放行；否则过 canContinue（拒歌词）。
    if (pendingRole && (prevSep || canContinue(text))) {
      expandCredit(pendingRole, text, pushCredit, seen);
      prevEndedWithSep = /[\/／、]\s*$/.test(text);
      continue;
    }
    // BUG #1/#2/#5 修复：多行 credit 值续行（录音棚/录音师/合唱 跨多行列出多个工作室/人名）。
    // 关键：改用 strongContinuation（严格判定）替代旧 isContinuationValue（过宽松→把歌词误抓为 credit）。
    //   续接仅在：① 上一行值以 / 、 结尾（模式 B）；② 含工作室/团体/公司关键词或 CamelCase 工作室名（模式 A）。
    //   其余无信号的英文/中文歌词行一律丢弃，彻底堵住「出品/母带/演唱 之后歌词被套用角色」的系统性误抓。
    const last = result.credits[result.credits.length - 1] ?? null;
    if (last && !pendingRole && strongContinuation(text, prevSep)) {
      expandCredit(last.roleRaw, text, pushCredit, seen);
      prevEndedWithSep = /[\/／、]\s*$/.test(text);
      continue;
    }
    // 其他裸行（歌词等）不处理
  }

  return result;
}

/** HTML 实体解码（&#xHH;/&#NNN;/&amp; 等 → 字符）。不碰裸 &（如「Society & Choir」）。 */
function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/**
 * 智能读取 lrc 文本，处理十年跨度的多编码现实。
 * 策略（确定性、可复现）：
 *  1. UTF-8 BOM (EF BB BF) → 去 BOM 按 UTF-8；
 *  2. 无 BOM → 先严格试 UTF-8，若无替换字符 U+FFFD 即判定 UTF-8；
 *  3. 含替换字符（说明有非法 UTF-8 字节）→ 按 GBK 解码（覆盖简体中文老文件）。
 * 实测本批语料 1108 个里 1107 个是 GBK、1 个 UTF-8，此策略全部命中。
 * 解码后统一做 HTML 实体解码（BUG K）。
 */
function readFileSmart(filePath: string): { text: string; encoding: string } {
  const buf = fs.readFileSync(filePath);
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return { text: decodeHtmlEntities(buf.slice(3).toString('utf-8')), encoding: 'utf8-bom' };
  }
  const asUtf8 = buf.toString('utf-8');
  if (!asUtf8.includes('\uFFFD')) return { text: decodeHtmlEntities(asUtf8), encoding: 'utf8' };
  return { text: decodeHtmlEntities(iconv.decode(buf, 'gbk')), encoding: 'gbk' };
}

/** 递归收集目录下所有 .lrc（含专辑子目录）。 */
function walkLrc(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walkLrc(p));
    else if (e.name.toLowerCase().endsWith('.lrc')) out.push(p);
  }
  return out;
}

function processFile(
  filePath: string,
  baseDir?: string,
): { file: string; encoding: string; parse: LrcParse } {
  const { text, encoding } = readFileSmart(filePath);
  const rel = baseDir ? path.relative(baseDir, filePath) : path.basename(filePath);
  const parse = parseLrc(text);
  // BUG Q: 空 ti 用文件名兜底; BUG L: 误标(鱼)标记待核
  if (!parse.title) {
    const base = path.basename(filePath).replace(/\.lrc$/i, '');
    if (base) {
      parse.title = base;
      parse.titleSource = 'filename';
    }
  } else if (parse.title === '鱼') {
    parse.titleSource = 'suspect';
  } else {
    parse.titleSource = 'lrc';
  }
  return { file: rel, encoding, parse };
}

/** 名字若仍含并列分隔符（说明没拆净）或过长，视为「可疑」，供人工复核。
 * 注：括号（工作室「(HOYO-MiX)」、CV「（CV：声优）」）按用户拍板为有意保留内容，不再判可疑。
 * 2026-07-14: @工作室 后缀已提取到 studio 字段，名字不再含 @。 */
function isSuspiciousName(n: string): boolean {
  return /[\/／,，]|feat\.?|ft\.?/i.test(n) || n.length > 40;
}

/**
 * 汇总质检报告（--report）：面向上千首、跨十年多写法的语料。
 * 红旗指标：① 抽到 0 条 credit 的文件（格式可能没覆盖）；
 *          ② 全部角色写法去重清单（人工扫一眼补 ROLE_ALIASES / 发现错拆）；
 *          ③ 可疑名字（残留分隔符/括号=没拆净）。
 */
function printReport(results: { file: string; parse: LrcParse }[]) {
  const zeroFiles: string[] = [];
  const roleFreq = new Map<string, number>();
  const roleUnmapped = new Set<string>();
  const suspicious: { file: string; role: string; name: string }[] = [];
  const suspectTitle: string[] = [];
  let totalCredits = 0;

  for (const { file, parse } of results) {
    if (parse.credits.length === 0) zeroFiles.push(file);
    if (parse.titleSource === 'suspect') suspectTitle.push(file);
    for (const c of parse.credits) {
      totalCredits++;
      roleFreq.set(c.roleRaw, (roleFreq.get(c.roleRaw) || 0) + 1);
      if (!c.roleCanonical) roleUnmapped.add(c.roleRaw);
      if (isSuspiciousName(c.name)) suspicious.push({ file, role: c.roleRaw, name: c.name });
    }
  }

  const roleSorted = [...roleFreq.entries()].sort((a, b) => b[1] - a[1]);

  console.log('\n════════ 抽取质检报告 ════════');
  console.log(`文件总数: ${results.length}   总单值条目: ${totalCredits}   平均: ${(totalCredits / Math.max(results.length, 1)).toFixed(1)} 条/文件`);

  console.log(`\n🚩 抽到 0 条 credit 的文件 (${zeroFiles.length}): ${zeroFiles.length ? '' : '无 ✓'}`);
  zeroFiles.slice(0, 50).forEach((f) => console.log(`   - ${f}`));
  if (zeroFiles.length > 50) console.log(`   … 还有 ${zeroFiles.length - 50} 个`);

  console.log(`\n⚠️  标题待核(suspect, 如误标"鱼") (${suspectTitle.length}): ${suspectTitle.length ? '' : '无 ✓'}`);
  suspectTitle.slice(0, 50).forEach((f) => console.log(`   - ${f}`));
  if (suspectTitle.length > 50) console.log(`   … 还有 ${suspectTitle.length - 50} 个`);

  console.log(`\n📋 出现过的角色写法去重 (${roleSorted.length} 种，按频次)：`);
  roleSorted.forEach(([r, n]) => {
    const mapped = ROLE_ALIASES[r] ? `→${ROLE_ALIASES[r]}` : '（未归一）';
    console.log(`   ${String(n).padStart(5)}  ${r}  ${mapped}`);
  });

  console.log(`\n⚠️  未归一化的角色 (${roleUnmapped.size})：${[...roleUnmapped].join('  |  ') || '无'}`);

  console.log(`\n🔎 可疑名字（残留分隔符/括号/@，可能没拆净）(${suspicious.length}):`);
  suspicious.slice(0, 50).forEach((s) => console.log(`   [${s.role}] ${s.name}   (${s.file})`));
  if (suspicious.length > 50) console.log(`   … 还有 ${suspicious.length - 50} 条`);
  console.log('══════════════════════════════\n');
}

function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const asReport = args.includes('--report');
  const dirIdx = args.indexOf('--dir');
  const fileIdx = args.indexOf('--file');

  let files: string[] = [];
  let baseDir: string | undefined;
  if (fileIdx >= 0 && args[fileIdx + 1]) {
    files = [args[fileIdx + 1]];
  } else if (dirIdx >= 0 && args[dirIdx + 1]) {
    baseDir = args[dirIdx + 1];
    files = walkLrc(baseDir); // 递归，含专辑子目录
  } else {
    console.error('用法: extractLrcCreators.ts --dir <目录> | --file <文件> [--json] [--report]');
    process.exit(1);
  }

  const results = files.map((f) => processFile(f, baseDir));

  if (asReport) {
    printReport(results);
  } else if (asJson) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    for (const { file, parse } of results) {
      console.log(`\n=== ${file} ===`);
      console.log(`  标题: ${parse.title ?? '(无)'}  [${parse.titleSource ?? 'lrc'}]`);
      console.log(`  专辑: ${parse.album ?? '(无)'}`);
      console.log(`  展开后单值创作者条目: ${parse.credits.length} (每行=一角色+一名字)`);
      for (const c of parse.credits) {
        const tag = c.roleCanonical ? `  (归一: ${c.roleCanonical})` : '';
        const st = c.studio ? `  {studio: ${c.studio}}` : '';
        console.log(`    - [${c.roleRaw}] ${c.name}${tag}${st}`);
      }
    }
  }
}

if (require.main === module) {
  main();
}
