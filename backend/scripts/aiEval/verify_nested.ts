/** verify_nested.ts — 验证嵌套子职务 + CV 格式提取 */
import { extractCredits } from '../../src/services/aiService';
import { readLrc } from '../aiEval/lib';

(async () => {
  const tests = [
    'D:/CreditDebug/LRC/ToT上传用/未定事件簿：契 - Resonance (「万灵局·妖闻簿」主题曲)/契 - Resonance.lrc',
    'D:/CreditDebug/LRC/GI上传用/原神-「经过 Passing Memories」四周年主题曲EP专辑/经过 Passing Memories.lrc',
    'D:/CreditDebug/LRC/GI上传用/原神-「轻涟 La vaguelette」游戏原声EP专辑/轻涟 La vaguelette.lrc',
  ];
  for (const f of tests) {
    console.log('\n### ' + f.split('/').pop());
    const credits = await extractCredits(readLrc(f));
    for (const c of credits) console.log('  ' + c.role + ' → ' + c.names.join(' / '));
  }
})();
