import * as fs from 'fs';
import * as path from 'path';
const CACHE = path.resolve(__dirname, '.cache');
function parseOL(wt: string) {
  const m = wt.match(/{{Other Languages([\s\S]*?)}}/i);
  const out: Record<string, string> = {};
  if (!m) return out;
  for (const line of m[1].split(/\n/)) {
    const mm = line.match(/^\s*\|?\s*([a-z0-9_]+)\s*=\s*(.+?)\s*$/i);
    if (mm) { const k = mm[1].toLowerCase().replace(/^\d+_/, ''); out[k] = mm[2].replace(/{{[^}]*}}/g, '').trim(); }
  }
  return out;
}
const files = fs.readdirSync(CACHE).filter((f) => f.endsWith('.json'));
console.log('total cache files:', files.length);
const hits: string[] = [];
for (const f of files) {
  let d: any; try { d = JSON.parse(fs.readFileSync(path.join(CACHE, f), 'utf8')); } catch { continue; }
  const p = d?.parse; if (!p || !p.title) continue;
  const t: string = p.title;
  if (/nemesis|scorched|golden blood/i.test(t)) {
    const wt = p.wikitext?.['*'] || '';
    const ol = parseOL(wt);
    const redir = JSON.stringify(p.redirects || []);
    hits.push('FILE ' + f + '\n  title="' + t + '"  redirect=' + redir + '\n  OL.zhs=' + (ol.zhs || '') + ' OL.zht=' + (ol.zht || ''));
  }
}
console.log('\n=== pages mentioning Nemesis/Scorched/Golden Blood ===');
console.log(hits.length ? hits.join('\n\n') : '(none in cache)');
