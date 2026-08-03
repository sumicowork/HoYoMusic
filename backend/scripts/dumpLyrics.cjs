/**
 * dumpLyrics.cjs — 提取所有 LRC 的定时行，导出为 JSON 供大模型判断
 */
const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');

const DIRS = ['D:/CreditDebug', 'D:/补充'];
const OUT = 'C:/Users/sumi/AppData/Local/Temp/lrc_dump.json';

const allFiles = [];
for (const d of DIRS) {
  walk(d, allFiles);
}

function walk(dir, results) {
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) walk(full, results);
    else if (entry.endsWith('.lrc')) results.push(full);
  }
}

const output = [];
for (const file of allFiles) {
  const content = fs.readFileSync(file);
  const asUtf8 = content.toString('utf-8');
  const text = asUtf8.includes('\uFFFD') ? iconv.decode(content, 'gbk') : asUtf8;
  
  const timedLines = text.split(/\r?\n/)
    .filter(l => /^\[\d{2}:\d{2}\.\d{2,3}\]/.test(l))
    .map(l => l.trim());
  
  const relativePath = path.relative(DIRS.find(d => file.startsWith(d)), file);
  
  output.push({
    path: relativePath,
    totalLines: timedLines.length,
    lines: timedLines,
  });
}

fs.writeFileSync(OUT, JSON.stringify(output, null, 2));
console.log(`Dumped ${output.length} files to ${OUT}`);
console.log(`Total timed lines: ${output.reduce((s,f) => s + f.totalLines, 0)}`);
