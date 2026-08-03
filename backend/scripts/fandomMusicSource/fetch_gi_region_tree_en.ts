/**
 * 快速版：只抓原神 Region → Area → Subarea 的【英文层级树】（不抓每个 subarea 的中文）
 * 中文后面直接用库里已有的翻译去匹配。
 * 只读 fandom，不碰数据库。输出 out/gi_region_tree_en.json
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, 'out');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const API = 'https://genshin-impact.fandom.com/api.php';
const REGIONS = ['Mondstadt', 'Liyue', 'Inazuma', 'Sumeru', 'Fontaine', 'Natlan'];

async function fetchJson(url: string): Promise<any> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (attempt < 2) await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
      else throw e;
    }
  }
}

function extractLinksFromSection(html: string, sectionId: string): string[] {
  const m = html.match(new RegExp(`id="${sectionId}"[^>]*>.*?<\\/h\\d>([\\s\\S]*?)(?:<h\\d|<div class="page-footer)`, 'i'));
  if (!m) return [];
  const section = m[1];
  const links = new Set<string>();
  const matches = section.matchAll(/title="([^"]+)"/g);
  for (const mt of matches) {
    const title = mt[1];
    if (!/MB\)|KB\)/.test(title) && title.length > 2 && !title.startsWith('File:') && !title.includes(':')) {
      links.add(title.trim());
    }
  }
  return [...links];
}

/** 提取 Region 页的 Areas：兼容两种格式
 *  格式A: <h2>Areas</h2> 内直接是画廊链接
 *  格式B: <h2>Areas</h2> 内是 <h3>小标题（Sumeru 用）
 */
function extractAreasFromRegion(html: string): string[] {
  const m = html.match(/id="Areas"[^>]*>.*?<\/h\d>([\s\S]*?)(?:<h2|<div class="page-footer)/i);
  if (!m) return [];
  const section = m[1];
  // 格式A：直接画廊链接
  const galleryLinks = [...section.matchAll(/title="([^"]+)"/g)]
    .map(x => x[1])
    .filter(t => !/MB\)|KB\)/.test(t) && t.length > 2 && !t.startsWith('File:') && !t.includes(':'));
  if (galleryLinks.length > 0) return [...new Set(galleryLinks)];
  // 格式B：<h3> 小标题
  const h3 = [...section.matchAll(/<h3[^>]*id="([^"]+)"[^>]*>([^<]+)</g)]
    .map(x => x[2].trim())
    .filter(t => t.length > 2 && !t.includes('Subareas'));
  return h3;
}

/** 提取 Area 页的 Subareas：兼容 "Subareas" 和 "Areas" 两种段落名 */
function extractSubareasFromArea(html: string): string[] {
  const fromSub = extractLinksFromSection(html, 'Subareas');
  if (fromSub.length > 0) return fromSub;
  return extractLinksFromSection(html, 'Areas');
}

/** 清洗：去掉明显不是具体地点的导航垃圾 */
function isRealLocation(title: string): boolean {
  const junk = ['Subareas', 'World Quest', 'Out of Bounds', 'Quests', 'Realm of', 'Tutorial'];
  return !junk.some(j => title === j || title.includes(j));
}

async function main() {
  const tree: any = { regions: {} };

  for (const region of REGIONS) {
    console.log(`\n=== ${region} ===`);
    const regionUrl = `${API}?action=parse&page=${encodeURIComponent(region)}&prop=text&redirects=1&format=json`;
    const regionData = await fetchJson(regionUrl);
    const regionHtml = regionData?.parse?.text?.['*'] || '';
    const areas = extractAreasFromRegion(regionHtml).filter(isRealLocation);
    console.log(`  Areas(${areas.length}): ${areas.join(', ')}`);

    tree.regions[region] = { areas: {} };

    for (const area of areas) {
      const areaUrl = `${API}?action=parse&page=${encodeURIComponent(area)}&prop=text&redirects=1&format=json`;
      const areaData = await fetchJson(areaUrl);
      const areaHtml = areaData?.parse?.text?.['*'] || '';
      const subareas = extractSubareasFromArea(areaHtml).filter(isRealLocation);
      const pois = extractLinksFromSection(areaHtml, 'Points_of_Interest').filter(isRealLocation);
      const all = [...new Set([...subareas, ...pois])];

      // 把 Area 名里可能的 HTML 实体解码
      const decode = (s: string) => s.replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"');
      tree.regions[region].areas[decode(area)] = all.map(decode);
      console.log(`    ${area}: ${all.length} subareas`);
    }
  }

  const outFile = path.join(OUT, 'gi_region_tree_en.json');
  fs.writeFileSync(outFile, JSON.stringify(tree, null, 2));
  console.log(`\n=== 已输出 ${outFile} ===`);

  // 统计
  let totalAreas = 0, totalSubs = 0;
  for (const [region, rData] of Object.entries(tree.regions) as any) {
    const areaCount = Object.keys(rData.areas).length;
    let subCount = 0;
    for (const subs of Object.values(rData.areas)) subCount += (subs as string[]).length;
    totalAreas += areaCount; totalSubs += subCount;
    console.log(`  ${region}: ${areaCount} areas, ${subCount} subareas`);
  }
  console.log(`\n总计: ${Object.keys(tree.regions).length} regions, ${totalAreas} areas, ${totalSubs} subareas`);
}

main().catch(e => { console.error(e); process.exit(1); });
