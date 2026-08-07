import * as fs from 'fs';
import * as path from 'path';
const CACHE = path.resolve(__dirname, '.cache');
function isSound(t: string, w: string) { return /soundtrack/i.test(t) || /{{Soundtrack Infobox/i.test(w); }
function otherLangZh(wt: string): string {
  const m = wt.match(/{{Other Languages([\s\S]*?)}}/i); if (!m) return '';
  const o: Record<string, string> = {};
  for (const l of m[1].split(/\n/)) { const mm = l.match(/^\s*\|?\s*([a-z0-9_]+)\s*=\s*(.+?)\s*$/i); if (mm) o[mm[1].toLowerCase().replace(/^\d+_/, '')] = mm[2].replace(/{{[^}]*}}/g, '').trim(); }
  return o.zhs || o.zht || '';
}
const zhProviders = new Map<string, { title: string; isSound: boolean }[]>();
for (const f of fs.readdirSync(CACHE).filter((x) => x.endsWith('.json'))) {
  let d: any; try { d = JSON.parse(fs.readFileSync(path.join(CACHE, f), 'utf8')); } catch { continue; }
  const p = d?.parse; if (!p || !p.title) continue;
  const wt = p.wikitext?.['*'] || '';
  const zh = otherLangZh(wt); if (!zh) continue;
  const arr = zhProviders.get(zh) || [];
  arr.push({ title: p.title, isSound: isSound(p.title, wt) });
  zhProviders.set(zh, arr);
}
const csv = fs.readFileSync(path.resolve(__dirname, 'out/relookup_gi.csv'), 'utf8').split('\n').slice(1);
let fill = 0, ambiguous = 0; const ambSamples: string[] = [];
for (const line of csv) {
  if (!line.trim()) continue;
  const parts = line.split(',');
  const verdict = parts[parts.length - 1];
  if (verdict !== 'FILL_ZH') continue;
  fill++;
  const zh = parts[2].replace(/^"|"$/g, '');
  const prov = zhProviders.get(zh) || [];
  const ss = prov.filter((p) => p.isSound).length;
  const ns = prov.filter((p) => !p.isSound).length;
  if (ns > 0 && ss > 0) {
    ambiguous++;
    if (ambSamples.length < 15) {
      const pages = prov.map((p) => (p.isSound ? 'SONG:' : '') + p.title).join(', ');
      ambSamples.push('zh="' + zh + '" ns=' + ns + ' ss=' + ss + ' pages=[' + pages + ']');
    }
  }
}
console.log('FILL 总数: ' + fill);
console.log('其中"同名歧义"(既在地点页也在歌曲页出现): ' + ambiguous);
console.log('--- 歧义样本(需人工看是否真地点) ---');
ambSamples.forEach((s) => console.log('  ' + s));
