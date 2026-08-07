/**
 * gen_upload_manifest.ts — 生成批量上传清单（track_id ↔ LRC 相对路径）
 * 排除：已有有效 OSS 歌词的 track（valid_lyrics_ids.txt）
 * 输出：manifest.tsv（track_id\tLRC相对路径），LRC 打包目录沿用相对结构
 * 用法: EVAL_DATA_DIR=... npx ts-node scripts/aiEval/gen_upload_manifest.ts
 */
import path from 'path';
import fs from 'fs';
import { listLrcFiles, matchTrackByFilename, fetchTracks } from './lib';

const VALID_IDS = new Set(
  fs
    .readFileSync('C:/Users/sumi/AppData/Local/Temp/valid_lyrics_ids.txt', 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map(Number),
);

(async () => {
  const tracks = await fetchTracks(null);
  const LRC_ROOTS = ['D:/CreditDebug/QQ音乐下载'];
  const lrcs = listLrcFiles(LRC_ROOTS[0]);
  const manifest: string[] = [];
  const skipped: string[] = [];
  const unmatched: string[] = [];

  for (const f of lrcs) {
    const base = path.basename(f);
    // 专辑目录名作为匹配约束：同曲双收（同名不同专辑、内容不同）必须各归其位
    const albumHint = path.basename(path.dirname(f));
    const track = matchTrackByFilename(base, tracks, albumHint);
    if (!track) {
      unmatched.push(base);
      continue;
    }
    if (VALID_IDS.has(track.id)) {
      skipped.push(`${track.id}\t${base}`);
      continue;
    }
    let rel = f.replace(/\\/g, '/');
    for (const root of LRC_ROOTS) {
      if (rel.startsWith(root.replace(/\\/g, '/'))) {
        rel = rel.slice(root.length).replace(/^\//, '');
        break;
      }
    }
    manifest.push(`${track.id}\t${rel}`);
  }

  fs.writeFileSync('C:/Users/sumi/AppData/Local/Temp/upload_manifest.tsv', manifest.join('\n'), 'utf8');
  console.log(`待上传: ${manifest.length}`);
  console.log(`已跳过(有效OSS歌词): ${skipped.length}`);
  console.log(`未匹配: ${unmatched.length}`);
  for (const u of unmatched) console.log('  未匹配:', u);
})();
