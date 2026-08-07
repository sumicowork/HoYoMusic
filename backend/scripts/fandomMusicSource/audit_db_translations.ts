/**
 * Full audit of every TRANSLATED music_source_nodes row.
 *
 * Iron law (user 2026-07-12): never fabricate; every zh must trace to an
 * authoritative source. This script PROVES that traceability for each loaded
 * row by re-deriving the expected zh from the two real sources the pipeline
 * used, and flags anything it cannot account for:
 *
 *   PROVEN           name == words.json zh  OR  name == fandom Other-Languages zhs/zht
 *   MISMATCH         translated but name matches NEITHER source  -> real bug
 *   RISK_DISAMBIG    the fandom page is a disambiguation page     -> wrong-sense risk
 *   RISK_REDIRECT    the fandom page is a redirect to another title -> wrong-entity risk
 *   CONTRADICTION    same (game,en_name) has >=2 distinct name    -> >=1 wrong
 *   SUSPECT_SAME     status=translated but name === en_name       -> should be pending
 *
 * Pending rows are checked separately: if the en_name HAS an authoritative zh
 * we flag RECOVERABLE (the pipeline missed a translation) — this is the
 * "why so many pending" root-cause evidence, not a corruption.
 *
 * No DB writes. Pure read + report.
 */
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { parseOtherLanguages } from './fandomClient';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const CACHE_DIR = path.join(__dirname, '.cache');

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

interface FO {
  zhs?: string; zht?: string; ja?: string; ko?: string;
  isRedirect: boolean; isDisambig: boolean; resolvedTitle?: string;
}
const fandomOL = new Map<string, FO>();   // keyed by resolved title (lower)
const fandomOLnorm = new Map<string, FO>(); // keyed by normalized title (lower, alnum only)
const zhToTitles = new Map<string, string[]>(); // any fandom zhs/zht -> source titles (reverse map)
const redirectFrom = new Map<string, string>(); // requested -> resolved (lower)

function norm(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9一-鿿]/g, '');
}

function indexCache() {
  const files = fs.readdirSync(CACHE_DIR).filter((f) => f.endsWith('.json'));
  let parseCount = 0;
  for (const f of files) {
    let data: any;
    try { data = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, f), 'utf8')); }
    catch { continue; }
    const p = data?.parse;
    if (!p || !p.title) continue;
    parseCount++;
    const wt: string = p.wikitext?.['*'] || '';
    const ol = parseOtherLanguages(wt);
    const isDisambig =
      /{{(?:Template:)?Disambiguation/i.test(wt) ||
      /\[\[Category:\s*[^]]*Disambiguation/i.test(wt);
    const isRedirect = Array.isArray(p.redirects) && p.redirects.length > 0;
    const resolved = p.title;
    const rec: FO = {
      zhs: ol.zhs, zht: ol.zht, ja: ol.ja, ko: ol.ko,
      isRedirect, isDisambig, resolvedTitle: resolved,
    };
    fandomOL.set(resolved.toLowerCase(), rec);
    fandomOLnorm.set(norm(resolved), rec);
    if (ol.zhs) (zhToTitles.get(ol.zhs) || zhToTitles.set(ol.zhs, []).get(ol.zhs)!).push(resolved);
    if (ol.zht) (zhToTitles.get(ol.zht) || zhToTitles.set(ol.zht, []).get(ol.zht)!).push(resolved);
    if (isRedirect) {
      for (const r of p.redirects) {
        if (r?.from) redirectFrom.set(r.from.toLowerCase(), resolved.toLowerCase());
      }
    }
  }
  return parseCount;
}

function fandomLookup(en: string): FO | undefined {
  return fandomOL.get(en.toLowerCase())
    || fandomOL.get(redirectFrom.get(en.toLowerCase()) || '')
    || fandomOLnorm.get(norm(en));
}

function loadWords(): Map<string, any> {
  const fp = path.join(CACHE_DIR, 'words.json');
  const m = new Map<string, any>();
  if (!fs.existsSync(fp)) return m;
  const arr = JSON.parse(fs.readFileSync(fp, 'utf8'));
  for (const w of arr) m.set((w.en || '').trim().toLowerCase(), w);
  return m;
}

async function main() {
  const parseCount = indexCache();
  const words = loadWords();
  console.log(`[audit] cache parse-pages indexed: ${parseCount}; words.json entries: ${words.size}`);

  const client = new Client({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  });
  await client.connect();

  const { rows } = await client.query(
    `select id, game_id, category_id, parent_id, name, en_name, translation_status
     from music_source_nodes order by game_id, category_id, id`
  );
  console.log(`[audit] total nodes: ${rows.length}`);

  const GAME = { 1: 'genshin', 2: 'hsr' } as const;
  type Row = typeof rows[number];
  interface Out {
    id: number; game: string; category_id: number; parent_id: number | null;
    en_name: string; name: string; status: string;
    verdict: string; sources: string; fandomResolved: string; note: string;
  }
  const out: Out[] = [];
  const contraMap = new Map<string, Map<string, number>>(); // game|en -> name->count

  for (const r of rows as Row[]) {
    const game = GAME[r.game_id as 1 | 2] || `g${r.game_id}`;
    const en = (r.en_name || '').trim();
    const zh = (r.name || '').trim();
    const enL = en.toLowerCase();

    // track contradiction keys among translated
    if (r.translation_status === 'translated') {
      const ck = `${r.game_id}|${enL}`;
      if (!contraMap.has(ck)) contraMap.set(ck, new Map());
      const mm = contraMap.get(ck)!;
      mm.set(zh, (mm.get(zh) || 0) + 1);
    }

    if (r.translation_status !== 'translated') {
      // pending: is there an authoritative zh we missed?
      const w = words.get(enL);
      const fo = fandomOL.get(enL) || fandomOL.get(redirectFrom.get(enL) || '');
      const wzh = w?.zhCN || w?.zhTW || w?.zh;
      const hasAuth = (wzh && wzh !== en) || (fo && (fo.zhs && fo.zhs !== en) || (fo?.zht && fo.zht !== en));
      out.push({
        id: r.id, game, category_id: r.category_id, parent_id: r.parent_id,
        en_name: en, name: zh, status: 'pending',
        verdict: hasAuth ? 'RECOVERABLE' : 'PENDING_OK',
        sources: hasAuth ? 'words/fandom-has-zh' : '',
        fandomResolved: fo?.resolvedTitle || '',
        note: hasAuth ? '有权威中文但管线未翻(待增强)' : '',
      });
      continue;
    }

    // translated node
    const w = words.get(enL);
    const fo = fandomLookup(en);
    const wzh = w?.zhCN || w?.zhTW || w?.zh;
    const srcs: string[] = [];
    if (wzh && (wzh === zh)) srcs.push('words.json');
    if (fo && ((fo.zhs && fo.zhs === zh) || (fo.zht && fo.zht === zh))) srcs.push('fandomOL');
    if (GAME[r.game_id as 1 | 2] === 'hsr' && PROMPT_DICT[enL] === zh) srcs.push('PROMPT_DICT');

    let verdict = 'PROVEN';
    let note = '';
    if (zh === en) {
      verdict = 'SUSPECT_SAME';
      note = 'translated 但 name===en_name';
    } else if (srcs.length === 0) {
      // not reproducible from the node's own source page — but is this zh a
      // REAL fandom translation somewhere (reverse map)? If yes it's a
      // wrong-entity risk, not fabrication. If nowhere, it's a real bug.
      const inFandom = zhToTitles.has(zh);
      if (inFandom) {
        verdict = 'RISK_WRONGENTITY';
        note = `中文真实存在于fandom(页:${zhToTitles.get(zh)!.slice(0, 3).join('/')})但非本节点页→可能张冠李戴`;
      } else {
        verdict = 'MISMATCH';
        note = 'translated 且全库fandom/words都查不到此中文→疑为曲名/事件页名误作地点或臆造';
      }
    }
    if (fo?.isDisambig) { verdict = verdict === 'PROVEN' ? 'RISK_DISAMBIG' : verdict; note = (note + ' | fandom页是歧义页').trim(); }
    if (fo?.isRedirect) {
      const rt = fo.resolvedTitle || '';
      const sameEntity = norm(rt).includes(norm(en).slice(0, 6)) || norm(en).includes(norm(rt).slice(0, 6));
      if (verdict === 'PROVEN') { verdict = 'RISK_REDIRECT'; }
      note = (note + ` | fandom页重定向→${rt}${sameEntity ? '(实体一致)' : '(疑不同实体)'}`).trim();
    }

    out.push({
      id: r.id, game, category_id: r.category_id, parent_id: r.parent_id,
      en_name: en, name: zh, status: 'translated',
      verdict, sources: srcs.join('+'),
      fandomResolved: fo?.resolvedTitle || '',
      note,
    });
  }

  // mark contradictions
  let contraCount = 0;
  for (const [ck, mm] of contraMap) {
    if (mm.size <= 1) continue;
    contraCount++;
    for (const o of out) {
      if (o.status !== 'translated') continue;
      const key = `${o.game === 'genshin' ? 1 : 2}|${o.en_name.toLowerCase()}`;
      if (key === ck) {
        o.verdict = 'CONTRADICTION';
        o.note = (o.note + ` 同en_name有${mm.size}种不同中文`).trim();
      }
    }
  }

  // summary
  const byVerdict: Record<string, number> = {};
  for (const o of out) byVerdict[o.verdict] = (byVerdict[o.verdict] || 0) + 1;
  console.log('[audit] verdict distribution:');
  for (const [k, v] of Object.entries(byVerdict).sort((a, b) => b[1] - a[1]))
    console.log(`   ${k.padEnd(16)} ${v}`);

  // RISK / bug buckets for the user
  const bugMismatch = out.filter((o) => o.verdict === 'MISMATCH');
  const wrongEntity = out.filter((o) => o.verdict === 'RISK_WRONGENTITY');
  const redirectRisk = out.filter((o) => o.verdict === 'RISK_REDIRECT');
  const disambigRisk = out.filter((o) => o.verdict === 'RISK_DISAMBIG');
  const suspectSame = out.filter((o) => o.verdict === 'SUSPECT_SAME');
  console.log(`\n[audit] BUG/MISMATCH (zh nowhere in fandom/words): ${bugMismatch.length}`);
  console.log(`[audit] RISK_WRONGENTITY (zh real fandom but wrong page): ${wrongEntity.length}`);
  console.log(`[audit] RISK_REDIRECT: ${redirectRisk.length}  RISK_DISAMBIG: ${disambigRisk.length}  SUSPECT_SAME: ${suspectSame.length}`);

  const flagged = out.filter((o) => !o.verdict.startsWith('PROVEN') && o.verdict !== 'PENDING_OK' && o.verdict !== 'RECOVERABLE');
  console.log(`[audit] FLAGGED (need human/model review): ${flagged.length}`);

  // write CSV
  const csv = ['id,game,category_id,parent_id,en_name,name,status,verdict,sources,fandom_resolved,note']
    .concat(out.map((o) =>
      [o.id, o.game, o.category_id, o.parent_id ?? '', `"${o.en_name}"`, `"${o.name}"`, o.status, o.verdict, o.sources, o.fandomResolved, `"${o.note}"`].join(',')))
    .join('\n');
  const outPath = path.join(__dirname, 'out', 'translation_audit.csv');
  fs.writeFileSync(outPath, csv);
  console.log(`[audit] wrote ${outPath} (${out.length} rows)`);

  // write flagged-only CSV for review
  const flaggedCsv = ['id,game,category_id,en_name,name,verdict,sources,fandom_resolved,note']
    .concat(flagged.map((o) =>
      [o.id, o.game, o.category_id, `"${o.en_name}"`, `"${o.name}"`, o.verdict, o.sources, o.fandomResolved, `"${o.note}"`].join(',')))
    .join('\n');
  fs.writeFileSync(path.join(__dirname, 'out', 'translation_audit_flagged.csv'), flaggedCsv);
  console.log(`[audit] wrote out/translation_audit_flagged.csv (${flagged.length} rows)`);

  // dump samples to stdout for immediate eyeballing
  const samples = out.filter((o) => ['MISMATCH', 'RISK_WRONGENTITY', 'RISK_DISAMBIG', 'RISK_REDIRECT', 'CONTRADICTION', 'SUSPECT_SAME'].includes(o.verdict)).slice(0, 50);
  console.log('\n[audit] SAMPLE flagged rows:');
  for (const s of samples) console.log(`  [${s.verdict}] ${s.game} #${s.id} "${s.en_name}" -> "${s.name}" ${s.note ? '| ' + s.note : ''}`);

  await client.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
