/** match_stats.ts — 统计 1312 个历史 LRC 能匹配到生产库多少曲目（只读本地分析）
 * 用法: EVAL_DATA_DIR=... npx ts-node scripts/aiEval/match_stats.ts
 */
import path from 'path';
import fs from 'fs';
import { listLrcFiles, matchTrackByFilename, fetchTracks } from './lib';

(async () => {
  const tracks = await fetchTracks(null);
  const lrcs = listLrcFiles('D:/CreditDebug');
  console.log(`LRC 总数: ${lrcs.length} | DB tracks: ${tracks.length}`);

  const matched: { file: string; trackId: number; title: string }[] = [];
  const unmatched: { file: string; game: string }[] = [];
  for (const f of lrcs) {
    const base = path.basename(f);
    const track = matchTrackByFilename(base, tracks);
    if (track) matched.push({ file: base, trackId: track.id, title: track.title });
    else {
      const rel = f.replace(/\\/g, '/').replace('D:/CreditDebug/', '');
      const game = rel.split('/')[0] || '其他';
      unmatched.push({ file: base, game });
    }
  }

  console.log(`✅ 匹配成功: ${matched.length} (${(matched.length / lrcs.length * 100).toFixed(1)}%)`);
  console.log(`❌ 未匹配: ${unmatched.length}`);
  const byGame: Record<string, number> = {};
  for (const u of unmatched) byGame[u.game] = (byGame[u.game] || 0) + 1;
  console.log('未匹配分布:', JSON.stringify(byGame));
  console.log('\n=== 未匹配清单 ===');
  for (const u of unmatched) console.log(`  [${u.game}] ${u.file}`);
})();
