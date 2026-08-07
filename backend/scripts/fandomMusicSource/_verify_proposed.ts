import * as fs from 'fs';
import * as path from 'path';
const CACHE = path.resolve(__dirname, '.cache');
const cacheByTitle = new Map<string, { title: string; wt: string }>();
for (const f of fs.readdirSync(CACHE).filter((x) => x.endsWith('.json'))) {
  let d: any; try { d = JSON.parse(fs.readFileSync(path.join(CACHE, f), 'utf8')); } catch { continue; }
  const p = d?.parse; if (!p || !p.title) continue;
  cacheByTitle.set(p.title.toLowerCase(), { title: p.title, wt: p.wikitext?.['*'] || '' });
}
function pagesFor(zh: string) {
  const out: { title: string; isSound: boolean; cat: string }[] = [];
  for (const v of cacheByTitle.values()) {
    const m = v.wt.match(/{{Other Languages([\s\S]*?)}}/i); if (!m) continue;
    const o: Record<string, string> = {};
    for (const l of m[1].split(/\n/)) {
      const mm = l.match(/^\s*\|?\s*([a-z0-9_]+)\s*=\s*(.+?)\s*$/i);
      if (mm) o[mm[1].toLowerCase().replace(/^\d+_/, '')] = mm[2].replace(/{{[^}]*}}/g, '').trim();
    }
    if (o.zhs === zh || o.zht === zh) {
      out.push({ title: v.title, isSound: /soundtrack/i.test(v.title) || /{{Soundtrack Infobox/i.test(v.wt), cat: o.zhs || o.zht || '' });
    }
  }
  return out;
}
const cases: [number, string][] = [[7436,'匹诺康尼'],[7474,'渡画泉隐套餐价目表'],[7482,'星穹列车']];
for (const [id, zh] of cases) {
  console.log(`\n=== #${id} proposed zh="${zh}" ===`);
  const srcs = pagesFor(zh);
  if (srcs.length === 0) { console.log('  ⚠ NO fandom page provides this zh at all (unverifiable / likely fabricated by fuzzy hit)'); continue; }
  for (const s of srcs) console.log(`  ${s.isSound ? '[SOUNDTRACK✗]' : '[OK]'} ${s.title}`);
}
