/**
 * Translation layer for music-source nodes.
 *
 * Priority (user-confirmed 2026-07-12):
 *   1. fandom `Other Languages` zhs/zht on the *node's own page*  (most authoritative)
 *   2. genshin-dictionary.com words.json  (en → zhCN, Genshin only)
 *   3. (future) user-supplied dictionary file
 *   4. keep English + mark pending   (never block the pipeline)
 *
 * words.json lives at https://dataset.genshin-dictionary.com/words.json
 * (reached via the site's /zh-CN/opendata page). 2.47MB, 6445 records.
 * It is Genshin-only, so HSR tokens will mostly fall through to "pending".
 */
import fs from 'fs';
import path from 'path';

const WORDS_URL = 'https://dataset.genshin-dictionary.com/words.json';
const WORDS_CACHE = path.join(__dirname, '.cache', 'words.json');

interface WordRec {
  en: string;
  ja?: string;
  zhCN?: string;
  zhTW?: string;
  zh?: string;
  notesZh?: string;
  tags?: string[];
}

export class Translator {
  private words = new Map<string, WordRec>();
  private loaded = false;

  async load(force = false): Promise<void> {
    if (this.loaded && !force) return;
    fs.mkdirSync(path.dirname(WORDS_CACHE), { recursive: true });
    if (!fs.existsSync(WORDS_CACHE)) {
      console.log('[translator] downloading words.json ...');
      const res = await fetch(WORDS_URL, { headers: { 'User-Agent': 'HoYoMusic-Rebuild' } });
      const txt = await res.text();
      fs.writeFileSync(WORDS_CACHE, txt);
    }
    const arr: WordRec[] = JSON.parse(fs.readFileSync(WORDS_CACHE, 'utf8'));
    for (const w of arr) this.words.set(w.en.trim().toLowerCase(), w);
    this.loaded = true;
    console.log(`[translator] loaded ${this.words.size} dictionary entries`);
  }

  /** Translate one English token. fandomOverride (zhs from the token's own page) wins. */
  translateToken(en: string, fandomOverride?: string): { zh?: string; pending: boolean } {
    const clean = (en || '').trim();
    if (fandomOverride && fandomOverride.trim()) return { zh: fandomOverride.trim(), pending: false };
    const w = this.words.get(clean.toLowerCase());
    const zh = w?.zhCN || w?.zhTW || w?.zh;
    if (zh) return { zh, pending: false };
    return { zh: undefined, pending: true };
  }

  /** Translate a hierarchical path (e.g. ["Mondstadt","night"]). */
  translatePath(enPath: string[]): { zhPath: string[]; pending: boolean } {
    const zhPath: string[] = [];
    let pending = false;
    for (const tok of enPath) {
      const t = this.translateToken(tok);
      if (t.zh) zhPath.push(t.zh);
      else {
        zhPath.push(tok);
        pending = true;
      }
    }
    return { zhPath, pending };
  }
}

/**
 * Translate HSR `during` *prompt words* ("dialogue scene in", "Combat",
 * "Trailer", ...). These are semantic hints kept (never deleted) from the raw
 * `during` text; per user direction the translation method is to be chosen
 * later. This dictionary method is the first cut and is intentionally isolated
 * so it can be swapped for an LLM call without touching the rest of the pipeline.
 */
const PROMPT_DICT: Record<string, string> = {
  'dialogue scene in': '对话场景',
  'animated short': '动画短片',
  cutscene: '过场动画',
  trailer: '预告片',
  pv: 'PV',
  teaser: '先导预告',
  'show video': '展示视频',
  'candidacy video': '竞选视频',
  character: '角色',
  combat: '战斗',
  boss: '头目',
  'elite combat': '精英战斗',
  'echo of war': '战争回响',
  event: '活动',
  wardance: '演武仪典',
};

export function translatePrompt(en?: string): string | undefined {
  if (!en) return undefined;
  return PROMPT_DICT[en.trim().toLowerCase()] || en;
}
