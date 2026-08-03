/**
 * 从 fandom API 抓取原神完整的地区层级树：
 *   Region (Mondstadt) → Area (Starfell Valley) → Subarea (Mondstadt City)
 * 
 * 只读，不碰数据库。输出到 out/gi_region_tree.json
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, 'out');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const API = 'https://genshin-impact.fandom.com/api.php';

// 七国 + 其他地区
const REGIONS = ['Mondstadt', 'Liyue', 'Inazuma', 'Sumeru', 'Fontaine', 'Natlan'];

async function fetchJson(url: string): Promise<any> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      } else throw e;
    }
  }
}

/** 从渲染HTML中提取 Areas section 里的链接 */
function extractAreaLinks(html: string): string[] {
  // 找 id="Areas" 到下一个 heading 之间的内容
  const areasMatch = html.match(/id="Areas"[^>]*>.*?<\/h\d>([\s\S]*?)(?:<h\d|<div class="page-footer)/);
  if (!areasMatch) return [];
  
  const section = areasMatch[1];
  // 提取 title="XXX" 链接，去重，过滤文件大小标记
  const links = new Set<string>();
  const matches = section.matchAll(/title="([^"]+)"/g);
  for (const m of matches) {
    const title = m[1];
    // 过滤掉带文件大小的 (XX MB) 后缀
    if (!title.includes(' MB)') && !title.includes(' KB)') && title.length > 2) {
      links.add(title);
    }
  }
  return [...links];
}

/** 从渲染HTML中提取 Subareas section 里的链接 */
function extractSubareaLinks(html: string): string[] {
  const subMatch = html.match(/id="Subareas"[^>]*>.*?<\/h\d>([\s\S]*?)(?:<h\d|<div class="page-footer)/);
  if (!subMatch) return [];
  
  const section = subMatch[1];
  const links = new Set<string>();
  const matches = section.matchAll(/title="([^"]+)"/g);
  for (const m of matches) {
    const title = m[1];
    if (!title.includes(' MB)') && !title.includes(' KB)') && title.length > 2) {
      links.add(title);
    }
  }
  return [...links];
}

/** 从渲染HTML提取 Points of Interest */
function extractPOILinks(html: string): string[] {
  const poiMatch = html.match(/id="Points_of_Interest"[^>]*>.*?<\/h\d>([\s\S]*?)(?:<h\d|<div class="page-footer)/);
  if (!poiMatch) return [];
  
  const section = poiMatch[1];
  const links = new Set<string>();
  const matches = section.matchAll(/title="([^"]+)"/g);
  for (const m of matches) {
    const title = m[1];
    if (!title.includes(' MB)') && !title.includes(' KB)') && title.length > 2) {
      links.add(title);
    }
  }
  return [...links];
}

/** 抓取一个页面的 Other Languages 中文 */
async function fetchOtherLanguages(pageTitle: string): Promise<{ zh: string | null; transclude: string | null }> {
  try {
    const url = `${API}?action=parse&page=${encodeURIComponent(pageTitle)}&prop=wikitext&redirects=1&format=json`;
    const d = await fetchJson(url);
    const wt = d?.parse?.wikitext?.['*'] || '';
    if (!wt) return { zh: null, transclude: null };
    
    // 检查 Transclude
    const transcludeMatch = wt.match(/\{\{Other Languages\|Transclude=([^}|]+)/);
    if (transcludeMatch) {
      return { zh: null, transclude: transcludeMatch[1].trim() };
    }
    
    // 直接找 zhs
    const zhsMatch = wt.match(/\|zhs\s*=\s*([^\n|]+)/);
    if (zhsMatch) {
      return { zh: zhsMatch[1].trim(), transclude: null };
    }
    
    return { zh: null, transclude: null };
  } catch {
    return { zh: null, transclude: null };
  }
}

async function main() {
  const tree: any = {};

  for (const region of REGIONS) {
    console.log(`\n=== ${region} ===`);
    
    // 1. 抓 region 页面，提取 Areas
    const regionUrl = `${API}?action=parse&page=${encodeURIComponent(region)}&prop=text&redirects=1&format=json`;
    const regionData = await fetchJson(regionUrl);
    const regionHtml = regionData?.parse?.text?.['*'] || '';
    
    const areas = extractAreaLinks(regionHtml);
    console.log(`  Areas: ${areas.length} → ${areas.join(', ')}`);
    
    // 抓 region 的中文
    const regionOl = await fetchOtherLanguages(region);
    let regionZh = regionOl.zh;
    if (!regionZh && regionOl.transclude) {
      const tcOl = await fetchOtherLanguages(regionOl.transclude);
      regionZh = tcOl.zh;
    }
    console.log(`  zh: ${regionZh || '(not found)'}`);
    
    tree[region] = {
      en: region,
      zh: regionZh,
      areas: {}
    };

    // 2. 对每个 Area，抓它的页面，提取 Subareas
    for (const area of areas) {
      console.log(`  --- Area: ${area} ---`);
      const areaUrl = `${API}?action=parse&page=${encodeURIComponent(area)}&prop=text&redirects=1&format=json`;
      const areaData = await fetchJson(areaUrl);
      const areaHtml = areaData?.parse?.text?.['*'] || '';
      
      const subareas = extractSubareaLinks(areaHtml);
      const pois = extractPOILinks(areaHtml);
      const allSubs = [...new Set([...subareas, ...pois])];
      
      console.log(`    Subareas: ${subareas.length}, POIs: ${pois.length}`);
      if (allSubs.length > 0) {
        console.log(`    → ${allSubs.slice(0, 10).join(', ')}${allSubs.length > 10 ? '...' : ''}`);
      }
      
      // 抓 area 的中文
      const areaOl = await fetchOtherLanguages(area);
      let areaZh = areaOl.zh;
      if (!areaZh && areaOl.transclude) {
        const tcOl = await fetchOtherLanguages(areaOl.transclude);
        areaZh = tcOl.zh;
      }
      
      // 3. 对每个 Subarea，只抓中文（不递归更深）
      const subareaData: { en: string; zh: string | null }[] = [];
      for (const sub of allSubs) {
        // 限流
        await new Promise(r => setTimeout(r, 200));
        const subOl = await fetchOtherLanguages(sub);
        let subZh = subOl.zh;
        if (!subZh && subOl.transclude) {
          const tcOl = await fetchOtherLanguages(subOl.transclude);
          subZh = tcOl.zh;
        }
        subareaData.push({ en: sub, zh: subZh });
      }
      
      tree[region].areas[area] = {
        en: area,
        zh: areaZh,
        subareas: subareaData
      };
      
      // 限流
      await new Promise(r => setTimeout(r, 300));
    }
  }

  // 输出
  const outFile = path.join(OUT, 'gi_region_tree.json');
  fs.writeFileSync(outFile, JSON.stringify(tree, null, 2));
  console.log(`\n=== 输出到 ${outFile} ===`);
  
  // 统计
  let totalAreas = 0, totalSubs = 0, subsWithZh = 0;
  for (const [region, rData] of Object.entries(tree) as any) {
    const areaCount = Object.keys(rData.areas).length;
    let subCount = 0, zhCount = 0;
    for (const [area, aData] of Object.entries(rData.areas) as any) {
      subCount += aData.subareas.length;
      zhCount += aData.subareas.filter((s: any) => s.zh).length;
    }
    totalAreas += areaCount;
    totalSubs += subCount;
    subsWithZh += zhCount;
    console.log(`  ${region} (${rData.zh || '?'}): ${areaCount} areas, ${subCount} subareas (${zhCount} with zh)`);
  }
  console.log(`\n总计: ${totalAreas} areas, ${totalSubs} subareas, ${subsWithZh} with zh translation`);
}

main().catch(e => { console.error(e); process.exit(1); });
