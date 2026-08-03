import { Client } from "pg";
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// Import the dictionary from the translation script
const TRANSLATIONS: Record<string, string> = {
  "Zenless Zone Zero": "绝区零",
  "Character Demo": "角色展示",
  "Agent Story": "代理人秘闻",
  "Angels of Delusion": "妄想天使",
  "afternoon": "下午",
  "combat": "战斗",
  "Combat": "战斗",
};

async function main() {
  const c = new Client({
    host: process.env.DB_HOST || "127.0.0.1",
    port: parseInt(process.env.DB_PORT || "15433"),
    user: process.env.DB_USER || "sumicowork",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "hoyomusic",
  });
  await c.connect();

  // Get ALL nodes with their en_name
  const res = await c.query(`
    SELECT mn.id, mn.en_name, mn.name FROM music_source_nodes mn 
    JOIN music_source_categories mc ON mc.id = mn.category_id 
    WHERE mc.game_id = 3
    ORDER BY mn.id
  `);

  const issues: { id: number; ename: string; name: string; culprit: string; fragment: string }[] = [];

  for (const r of res.rows) {
    const ename: string = r.en_name;
    const name: string = r.name;
    
    if (ename === name) continue; // Not translated, skip

    // For each dictionary entry, check if it matches as SUBSTRING of a larger English word/phrase
    for (const [en, zh] of Object.entries(TRANSLATIONS)) {
      if (!ename.includes(en)) continue;
      
      // Find ALL occurrences of this entry in the ename
      let idx = 0;
      while ((idx = ename.indexOf(en, idx)) !== -1) {
        // Check context around the match
        const before = idx > 0 ? ename[idx - 1] : '';
        const after = idx + en.length < ename.length ? ename[idx + en.length] : '';
        
        // Is this part of a larger English word? (letters before/after)
        const isSubword = /[A-Za-z]/.test(before) || /[A-Za-z]/.test(after);
        
        // Or is this part of a proper noun phrase (context has more English words)?
        // Check if the broader context (10 chars before and after) contains significant English
        const context = ename.slice(Math.max(0, idx - 20), idx + en.length + 20);
        const englishRatio = (context.match(/[A-Za-z]/g) || []).length / context.length;
        const hasLotsOfEnglish = englishRatio > 0.5 && context.length > en.length * 2;
        
        if (isSubword) {
          issues.push({
            id: r.id, ename, name,
            culprit: `"${en}"→"${zh}" is SUBSTRING of larger word at position ${idx} (context: "${context.slice(0,50)}")`,
            fragment: `${ename.slice(0, idx)}【${en}】${ename.slice(idx + en.length)}`
          });
        } else if (hasLotsOfEnglish) {
          issues.push({
            id: r.id, ename, name,
            culprit: `"${en}"→"${zh}" isolated in English-heavy context (${Math.round(englishRatio*100)}% EN)`,
            fragment: `...${context.slice(0,60)}...`
          });
        }
        
        idx += en.length;
      }
    }
  }

  // Deduplicate by id
  const seen = new Set<number>();
  const unique: typeof issues = [];
  for (const i of issues) {
    if (!seen.has(i.id)) {
      seen.add(i.id);
      unique.push(i);
    }
  }

  console.log(`Found ${unique.length} nodes with potential fragmentation issues:\n`);
  
  // Group by culprit pattern
  const byPattern = new Map<string, typeof issues>();
  for (const i of unique) {
    const pattern = i.culprit.split(' at ')[0]; // Just the description
    if (!byPattern.has(pattern)) byPattern.set(pattern, []);
    byPattern.get(pattern)!.push(i);
  }

  for (const [pattern, items] of byPattern) {
    console.log(`\n### ${pattern} (${items.length} nodes)`);
    for (const item of items.slice(0, 3)) {
      console.log(`  #${item.id}: ${item.ename.slice(0,80)}`);
    }
    if (items.length > 3) console.log(`  ... and ${items.length - 3} more`);
  }

  await c.end();
}

main().catch(e => { console.error(e); process.exit(1); });
