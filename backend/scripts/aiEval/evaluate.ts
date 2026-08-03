/**
 * evaluate.ts — AI 歌词分析可用率评估（本地只读，不写生产）
 *
 * 用法：
 *   export DB_HOST=139.224.111.83 DB_PORT=5432 DB_USER=sumicowork DB_PASSWORD=xxx DB_NAME=hoyomusic
 *   export AI_API_BASE_URL=... AI_API_KEY=... AI_MODEL=deepseek-chat
 *   npx ts-node scripts/aiEval/evaluate.ts [--n 50] [--mock]
 *
 * 评估三件事：
 *  1. VOCAL/INST 分类准确率（真值 = DB lyrics_status，人工 7-25 标记）
 *  2. 创作者抽取可用率（真值 = DB track_credits，人工 v13 落地）
 *  3. 歌词清洗质量（无真值 → 输出清洗前后对比样本，人工复核）
 *
 * 输出：scripts/aiEval/out/eval_report_*.json + 控制台摘要
 */
import fs from 'fs';
import path from 'path';
import {
  readLrc,
  detectEncoding,
  normalizeTitle,
  normalizeName,
  matchTrackByFilename,
  connectDb,
  fetchTracks,
  fetchTrackCredits,
  fetchTracksByGame,
  listLrcFiles,
  TrackInfo,
} from './lib';
import { analyzeLyrics, extractCredits, analyzeLyricsMock, isMockMode, CreditLine } from '../../src/services/aiService';

const GAME_DIR_MAP: Record<string, string> = {
  GI: '原神',
  HSR: '崩坏：星穹铁道',
  ZZZ: '绝区零',
  ToT: '未定事件簿',
};

function parseArgs(): { n: number; root: string; mock: boolean; maxTracks: number } {
  const argv = process.argv.slice(2);
  const get = (k: string): string | undefined => {
    const i = argv.indexOf(k);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return {
    n: Number(get('--n') || 50),
    root: get('--root') || 'D:/CreditDebug',
    mock: argv.includes('--mock'),
    maxTracks: Number(get('--max-tracks') || 100000),
  };
}

// ── 真值对比工具 ──────────────────────────────────────────────────

interface TruthCredit {
  role: string;
  value: string;
}

/** 抽取对比：AI names vs 真值 names（归一化后集合） */
function compareCredits(
  aiCredits: CreditLine[],
  truth: TruthCredit[],
): {
  nameRecall: number; // AI 命中真值比例（AI 抽取的 name 中多少在真值里）
  namePrecision: number; // 真值被 AI 覆盖比例（真值 name 中多少被 AI 提到）
  roleMatchRate: number; // AI role 与真值 role 归一化相等比例
  perfect: boolean; // names 集合完全一致（数量+内容）
  partial: boolean;
} {
  const truthNames = new Set(truth.map((t) => normalizeName(t.value)));
  const aiNames = new Set(aiCredits.flatMap((c) => c.names.map(normalizeName)));
  const truthRoles = new Set(truth.map((t) => normalizeTitle(t.role)));
  const aiRoles = new Set(aiCredits.map((c) => normalizeTitle(c.role)));

  const hit = [...aiNames].filter((n) => truthNames.has(n)).length;
  const truthHit = [...truthNames].filter((n) => aiNames.has(n)).length;
  const nameRecall = truthNames.size > 0 ? truthHit / truthNames.size : aiNames.size === 0 ? 1 : 0;
  const namePrecision = aiNames.size > 0 ? hit / aiNames.size : 0;

  const roleHit = [...aiRoles].filter((r) => truthRoles.has(r)).length;
  const roleMatchRate = aiRoles.size > 0 ? roleHit / aiRoles.size : 0;

  const setsEqual =
    aiNames.size === truthNames.size &&
    [...aiNames].every((n) => truthNames.has(n)) &&
    aiNames.size > 0;
  const partial = !setsEqual && hit > 0;

  return { nameRecall, namePrecision, roleMatchRate, perfect: setsEqual, partial };
}

// ── 主流程 ────────────────────────────────────────────────────────

async function main() {
  const { n, root, mock, maxTracks } = parseArgs();
  const useMock = mock || isMockMode();
  if (useMock) {
    console.warn('⚠️  MOCK 模式（未配置 AI_API_KEY 或指定 --mock）：使用启发式模拟结果，仅验证流程');
  } else {
    console.log(`🤖 真实模式：AI_BASE_URL=${process.env.AI_API_BASE_URL} AI_MODEL=${process.env.AI_MODEL}`);
  }

  const client = process.env.EVAL_DATA_DIR ? null : await connectDb();
  console.log(client ? '📦 已连接 DB（只读）' : '📦 本地 dump 模式（EVAL_DATA_DIR）');

  // 1. 收集 LRC 文件并按游戏分层抽样
  const allLrc = listLrcFiles(root);
  console.log(`📄 找到 ${allLrc.length} 个 LRC`);
  const byGame: Record<string, string[]> = {};
  for (const f of allLrc) {
    // 游戏 = root 后第一段目录名（如 "GI上传用"）
    const rel = f.replace(/\\/g, '/').replace(root.replace(/\\/g, '/').replace(/\/+$/, '') + '/', '');
    const firstSeg = rel.split('/')[0] || '';
    const game = Object.keys(GAME_DIR_MAP).find((k) => firstSeg.includes(k)) || '其他';
    (byGame[game] ||= []).push(f);
  }
  const sampled: { file: string; game: string }[] = [];
  for (const [game, files] of Object.entries(byGame)) {
    const count = Math.max(1, Math.round((files.length / allLrc.length) * n));
    const shuffled = [...files].sort(() => Math.random() - 0.5);
    for (const f of shuffled.slice(0, Math.min(count, maxTracks))) sampled.push({ file: f, game });
  }
  console.log(`🎲 抽样 ${sampled.length} 首（${Object.entries(byGame).map(([g, fs2]) => `${g}${fs2.length ? Math.round((fs2.length / allLrc.length) * n) : 0}`).join('/')}）`);

  // 2. 加载全部 track 索引（内存匹配）
  const allTracks = await fetchTracks(client);
  console.log(`🎵 DB tracks: ${allTracks.length}`);

  // 3. 逐首评估
  const results: any[] = [];
  let clsN = 0, clsCorrect = 0;
  const clsConfusion: Record<string, Record<string, number>> = {};
  let extTrackN = 0;
  const extPerfect: string[] = [];
  const extPartial: string[] = [];
  const extNone: string[] = [];
  const extNoTruth: string[] = [];
  const allNameRecall: number[] = [];
  const allNamePrecision: number[] = [];
  const allRoleMatch: number[] = [];
  const cleaningSamples: { file: string; original: string; cleaned: string }[] = [];

  for (let i = 0; i < sampled.length; i++) {
    const { file, game } = sampled[i];
    const base = path.basename(file);
    console.log(`[${i + 1}/${sampled.length}] ${game}/${base}`);

    try {
      const lrcText = readLrc(file);
      const encoding = detectEncoding(file);
      const track = matchTrackByFilename(base, allTracks);

      // AI 分析（失败重试 1 次，空内容/网络抖动常见）
      let analysis;
      try {
        analysis = useMock ? await analyzeLyricsMock(lrcText) : await analyzeLyrics(lrcText);
      } catch (err: any) {
        console.warn(`  ⚠️ 首次失败(${err?.message ?? err})，重试 1 次`);
        analysis = useMock ? await analyzeLyricsMock(lrcText) : await analyzeLyrics(lrcText);
      }
      const aiCredits = analysis.credits;

      // 分类对比（真值 = DB lyrics_status）
      const truthStatus = track?.lyricsStatus ?? null;
      const truthKind = truthStatus === 'has' ? 'vocal' : truthStatus === 'instrumental' ? 'instrumental' : null;
      if (truthKind) {
        clsN++;
        const aiKind = analysis.kind;
        (clsConfusion[truthKind] ||= {})[aiKind] = ((clsConfusion[truthKind] || {})[aiKind] || 0) + 1;
        if (aiKind === truthKind) clsCorrect++;
      }

      // 抽取对比（真值 = DB track_credits）
      let truthCredits: TruthCredit[] = [];
      let extResult: ReturnType<typeof compareCredits> | null = null;
      if (track) {
        truthCredits = await fetchTrackCredits(client, track.id);
        if (truthCredits.length > 0) {
          extTrackN++;
          extResult = compareCredits(aiCredits, truthCredits);
          allNameRecall.push(extResult.nameRecall);
          allNamePrecision.push(extResult.namePrecision);
          allRoleMatch.push(extResult.roleMatchRate);
          if (extResult.perfect) extPerfect.push(base);
          else if (extResult.partial) extPartial.push(base);
          else extNone.push(base);
        } else {
          extNoTruth.push(base);
        }
      }

      // 清洗样本（前 5 首 vocal）
      if (analysis.kind === 'vocal' && analysis.cleanLyrics && cleaningSamples.length < 5) {
        cleaningSamples.push({ file: base, original: lrcText.slice(0, 800), cleaned: analysis.cleanLyrics.slice(0, 800) });
      }

      results.push({
        file: base,
        game,
        encoding,
        matchedTrack: track ? { id: track.id, title: track.title, status: track.lyricsStatus } : null,
        ai: { kind: analysis.kind, confidence: analysis.confidence, creditCount: aiCredits.length },
        truth: { status: truthStatus, creditCount: truthCredits.length },
        extraction: extResult,
      });
    } catch (err: any) {
      console.error(`  ❌ 失败: ${err.message}`);
      results.push({ file: base, game, error: String(err?.message ?? err) });
    }
  }

  // 4. 汇总
  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
  const summary = {
    meta: {
      sampled: sampled.length,
      mode: useMock ? 'mock' : 'real',
      aiModel: useMock ? '-' : process.env.AI_MODEL || 'deepseek-chat',
      lrcRoot: root,
      time: new Date().toISOString(),
    },
    classification: {
      n: clsN,
      correct: clsCorrect,
      accuracy: clsN ? clsCorrect / clsN : null,
      confusion: clsConfusion,
    },
    extraction: {
      tracksWithTruth: extTrackN,
      nameRecallAvg: avg(allNameRecall),
      namePrecisionAvg: avg(allNamePrecision),
      roleMatchRateAvg: avg(allRoleMatch),
      perfect: extPerfect.length,
      partial: extPartial.length,
      none: extNone.length,
      noTruth: extNoTruth.length,
      perfectFiles: extPerfect,
      partialFiles: extPartial,
      noneFiles: extNone,
    },
    cleaning: { vocalSamples: cleaningSamples.length },
  };

  const outDir = path.join(__dirname, 'out');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outFile = path.join(outDir, `eval_report_${stamp}.json`);
  fs.writeFileSync(outFile, JSON.stringify({ summary, details: results, cleaningSamples }, null, 2), 'utf8');

  // 控制台摘要
  console.log('\n' + '='.repeat(56));
  console.log('📊 评估摘要');
  console.log('='.repeat(56));
  const c = summary.classification;
  console.log(`\n【1. VOCAL/INST 分类】`);
  console.log(`  样本 ${c.n} 首（真值已标记）| 正确 ${c.correct} | 准确率 ${c.accuracy ? (c.accuracy * 100).toFixed(1) : '-'}%`);
  console.log(`  混淆矩阵: ${JSON.stringify(c.confusion)}`);
  const e = summary.extraction;
  console.log(`\n【2. 创作者抽取】`);
  console.log(`  真值 track ${e.tracksWithTruth} 首`);
  console.log(`  人名 Recall(真值覆盖) ${(e.nameRecallAvg * 100).toFixed(1)}% | Precision(AI命中) ${(e.namePrecisionAvg * 100).toFixed(1)}%`);
  console.log(`  角色(credit_key)匹配率 ${(e.roleMatchRateAvg * 100).toFixed(1)}%`);
  console.log(`  整首级别: 完全 ${e.perfect} | 部分 ${e.partial} | 未命中 ${e.none} | 无真值 ${e.noTruth}`);
  console.log(`\n【3. 歌词清洗】${summary.cleaning.vocalSamples} 个样本已附在报告中，请人工复核`);
  console.log(`\n📄 报告: ${outFile}`);
  if (client) await client.end();
}

main().catch((err) => {
  console.error('评估失败:', err);
  process.exit(1);
});
