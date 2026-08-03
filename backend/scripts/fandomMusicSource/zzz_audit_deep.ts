import { Client } from "pg";
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function main() {
  const c = new Client({
    host: process.env.DB_HOST || "127.0.0.1",
    port: parseInt(process.env.DB_PORT || "15433"),
    user: process.env.DB_USER || "sumicowork",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "hoyomusic",
  });
  await c.connect();

  const r = await c.query(
    "SELECT mn.id, mn.name, mn.en_name FROM music_source_nodes mn JOIN music_source_categories mc ON mc.id=mn.category_id WHERE mc.game_id=3 AND mc.name=$1 ORDER BY mn.id",
    ["PV/宣传"]
  );

  console.log("PV/宣传 nodes: " + r.rows.length + "\n");

  for (const n of r.rows) {
    const en: string = n.en_name;
    const nm: string = n.name;
    console.log(`#${n.id} | ${nm}`);
    console.log(`  en: ${en}`);

    // Extract structured info
    const epMatch = en.match(/^(.*?) EP\s*[-–—]\s*"([^"]+)"/);
    if (epMatch) {
      console.log(`  → Character: ${epMatch[1]}, Song: "${epMatch[2]}"`);
    }

    const demoMatch = en.match(/^(.*?) Character Demo\s*[-–—]\s*"([^"]+)"/);
    if (demoMatch) {
      console.log(`  → Character: ${demoMatch[1]}, Demo: "${demoMatch[2]}"`);
    }

    const teaserMatch = en.match(/Version.*Teaser\s*[-–—]\s*"([^"]+)"/);
    if (teaserMatch) {
      console.log(`  → Teaser: "${teaserMatch[1]}"`);
    }

    // Semantic checks
    if (en.length < 10) console.log("  ⚠️ Very short ename");
    
    // Check quote balance
    const nameQuotes = (nm.match(/"/g) || []).length;
    if (nameQuotes % 2 !== 0) console.log("  ❌ Unbalanced quotes in name");
    
    const enQuotes = (en.match(/"/g) || []).length;
    if (enQuotes % 2 !== 0) console.log("  ❌ Unbalanced quotes in ename");
    
    // Check if ename has "and " prefix
    if (en.startsWith("and ")) console.log("  ❌ ename starts with 'and '");

    // Check for stray pipe or suffix
    if (nm.includes(" | ") || nm.includes(" - 绝区零")) console.log("  ❌ Has YouTube clutter");
    
    // Check for wiki internal links
    if (nm.includes("/Stages#") || en.includes("/Stages#")) console.log("  ❌ Has wiki internal link");
    
    console.log();
  }

  await c.end();
}

main().catch(e => { console.error(e); process.exit(1); });
