/**
 * scanLyrics.cjs — 扫描所有 LRC，统计含真歌词/纯器乐/纯credits 数量
 */
const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');

const DIRS = ['D:/CreditDebug', 'D:/补充'];

function isCreditLine(line) {
  const m = line.match(/^\[\d{2}:\d{2}\.\d{2,3}\]\s*(.+)/);
  if (!m) return false;
  const txt = m[1];
  return /(作词|作曲|编曲|制作人|混音|母带|录音|出品|吉他|钢琴|弦乐|和声|人声|乐器|演唱者?|演奏|Lyricist|Composer|Arranger|Producer|Mixing|Mastering|Recording|Engineer|Vocal|Guitar|Piano|Strings|Orchestra|Copyist|Band|Dizi|Erhu|Electric\s|Choir|Conductor|Music\s)/i.test(txt) && txt.length < 80;
}

function isTitleLine(line) {
  // [00:00.00]Song Title - Artist
  const m = line.match(/^\[\d{2}:\d{2}\.\d{2,3}\]\s*(.+)/);
  return m && !isCreditLine(line) && /[-–—]\s/.test(m[1]) && m[1].length < 60;
}

function walk(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) results.push(...walk(full));
    else if (entry.endsWith('.lrc')) results.push(full);
  }
  return results;
}

const allFiles = [];
for (const d of DIRS) allFiles.push(...walk(d));

console.log(`Total LRC files: ${allFiles.length}`);

let vocal = 0, instrumental = 0, creditOnly = 0;

for (const file of allFiles) {
  const content = fs.readFileSync(file);
  let text;
  // 先试 UTF-8，有无效字符则回退 GBK
  const asUtf8 = content.toString('utf-8');
  if (!asUtf8.includes('\uFFFD')) {
    text = asUtf8;
  } else {
    text = iconv.decode(content, 'gbk');
  }
  
  const lines = text.split(/\r?\n/).filter(l => /^\[\d{2}:\d{2}\.\d{2,3}\]/.test(l));
  
  const creditLines = lines.filter(isCreditLine);
  const titleLines = lines.filter(isTitleLine);
  const realLines = lines.filter(l => {
    if (isCreditLine(l)) return false;   // 排除credits
    if (isTitleLine(l)) return false;    // 排除标题行
    const m = l.match(/^\[\d{2}:\d{2}\.\d{2,3}\]\s*(.+)/);
    if (!m) return false;
    const txt = m[1].trim();
    // 排除空行和纯符号
    return txt.length > 2 && !/^[,，.。、;；:：!！?？\s]+$/.test(txt);
  });
  
  if (realLines.length > 0) vocal++;
  else if (creditLines.length > 0) creditOnly++;
  else instrumental++;
}

console.log(`Vocal (has lyrics): ${vocal}`);
console.log(`Instrumental: ${instrumental}`);
console.log(`Credit-only (no actual lyrics): ${creditOnly}`);
