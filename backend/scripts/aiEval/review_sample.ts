/** review_sample.ts — 人工复核抽样：输出 AI 提取结果（以 LRC 原文为唯一标准人工核对） */
import path from 'path';
import { extractCredits } from '../../src/services/aiService';
import { readLrc } from '../aiEval/lib';

const picks = [
  'GI上传用/原神-「未行之路 The Road Not Taken」游戏原声EP专辑/未行之路 The Road Not Taken.lrc',
  'GI上传用/原神-万流始源之海 Pelagic Primaevality/万象裁灭之刻 Eschatologia Iudicata.lrc',
  'HSR上传用/崩坏星穹铁道-行于命途 Experience the Paths/银河漫游 Galactic Roaming.lrc',
  'HSR上传用/崩坏星穹铁道-长生梦短 Svah Sanishyu/星文照旅魂 Ave Astra et Viator.lrc',
  'ZZZ上传用/绝区零-极限委托：PV原声集/TKO.lrc',
  'ZZZ上传用/绝区零-问/问.lrc',
  'ToT上传用/未定事件簿OST1：邂逅/38 天定·思索.lrc',
  'LRC/ZZZ上传用/绝区零-天琴座+/闪亮 (伴奏).lrc',
  'GI上传用/原神-灼火之心 Blazing Heart/灼火之心 Blazing Heart.lrc',
  'HSR上传用/崩坏星穹铁道-洞穴寓言（上篇）Allegory of the Cave (Part 1)/起初和终结 Origin and Finale.lrc',
];

(async () => {
  for (const rel of picks) {
    const file = 'D:/CreditDebug/' + rel;
    const lrc = readLrc(file);
    console.log('\n### ' + path.basename(file));
    try {
      const credits = await extractCredits(lrc);
      for (const c of credits) console.log('  ' + c.role + ' → ' + c.names.join(' / '));
    } catch (e: any) {
      console.log('  ❌ ' + (e?.message ?? e));
    }
  }
})();
