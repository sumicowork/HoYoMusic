/**
 * quick_compare.ts — 针对指定 LRC 文件，逐行对比 AI 抽取 vs DB 真值
 * 用法: npx ts-node scripts/aiEval/quick_compare.ts <lrc文件路径> [更多路径...]
 * 环境变量: DB_* (生产) / AI_* (API)
 */
import path from 'path';
import { readLrc, normalizeName, matchTrackByFilename, connectDb, fetchTracks, fetchTrackCredits } from './lib';
import { extractCredits, CreditLine } from '../../src/services/aiService';

async function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error('用法: ts-node quick_compare.ts <lrc路径> [更多...]');
    process.exit(1);
  }
  const client = process.env.EVAL_DATA_DIR ? null : await connectDb();
  const tracks = await fetchTracks(client);

  for (const file of files) {
    console.log(`\n${'='.repeat(64)}`);
    console.log(`📄 ${path.basename(file)}`);
    const lrcText = readLrc(file);
    const track = matchTrackByFilename(path.basename(file), tracks);
    console.log(`   匹配 track: ${track ? `#${track.id} ${track.title}` : '❌ 未匹配'}`);

    let ai: CreditLine[] = [];
    try {
      ai = await extractCredits(lrcText);
    } catch (err: any) {
      console.log(`   ❌ AI 失败: ${err?.message ?? err}`);
    }

    const truth = track ? await fetchTrackCredits(client, track.id) : [];
    const truthNames = new Set(truth.map((t) => normalizeName(t.value)));
    const aiNames = new Set(ai.flatMap((c) => c.names.map(normalizeName)));

    console.log(`   AI 提取 ${ai.reduce((s, c) => s + c.names.length, 0)} 个名字 / ${ai.length} 行 | DB 真值 ${truth.length} 行`);

    // 并排逐行对比（按 role 对齐，展示每个名字的命中状态）
    const truthByName = new Map<string, string>();
    for (const t of truth) truthByName.set(normalizeName(t.value), t.role);
    const aiByNorm = new Map<string, string>();
    for (const c of ai) for (const n of c.names) aiByNorm.set(normalizeName(n), c.role);

    const missing: string[] = [];
    const extra: string[] = [];
    for (const [n, role] of truthByName) {
      if (aiByNorm.has(n)) continue;
      missing.push(`${role} → ${n}`);
    }
    for (const [n, role] of aiByNorm) {
      if (truthByName.has(n)) continue;
      extra.push(`${role} → ${n}`);
    }

    console.log(`   ❌ AI 缺失 ${missing.length} 个:`);
    for (const m of missing) console.log(`     - ${m}`);
    console.log(`   ➕ AI 多出 ${extra.length} 个:`);
    for (const e of extra) console.log(`     + ${e}`);

    if (missing.length === 0 && extra.length === 0) console.log('   ✅ 完全一致');
  }
  if (client) await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
