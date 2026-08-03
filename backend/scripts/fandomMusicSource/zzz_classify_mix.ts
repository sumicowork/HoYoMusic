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

  const res = await c.query(`
    SELECT mc.name cat, mn.id, mn.name, mn.en_name FROM music_source_nodes mn 
    JOIN music_source_categories mc ON mc.id=mn.category_id 
    WHERE mc.game_id=3 AND mn.name ~ '[\\u4e00-\\u9fff]' AND mn.name ~ '[A-Za-z]{3,}'
    ORDER BY mc.name, mn.id
  `);

  const categories: Record<string, { count: number; examples: string[] }> = {
    "EP/Character Demo (character CN + title EN)": { count: 0, examples: [] },
    "Teaser/Version (EN format + CN song)": { count: 0, examples: [] },
    "Time-of-day mix (afternoon solo)": { count: 0, examples: [] },
    "Combat scenario mix (combat solo)": { count: 0, examples: [] },
    "Commission mix (委托 solo)": { count: 0, examples: [] },
    "Story scene mix (single CN word in EN sentence)": { count: 0, examples: [] },
    "Advertisement nodes": { count: 0, examples: [] },
    "Hollow/Cretan/Lemnian mix": { count: 0, examples: [] },
    "Movie in / featured in": { count: 0, examples: [] },
    "Battle with/against mix": { count: 0, examples: [] },
    "Other acceptable": { count: 0, examples: [] },
  };

  for (const r of res.rows) {
    const n: string = r.name;
    
    if (n.match(/EP|Character Demo|Animated Short|Agent Story|MV/) && n.match(/[\u4e00-\u9fff]/) && n.match(/[A-Za-z]/)) {
      // Character names translated, titles stay EN — acceptable
      if (n.match(/weekdays|weekends|morning|evening|midnight/)) {
        // But time mixing is bad
        categories["Time-of-day mix (afternoon solo)"].count++;
        if (categories["Time-of-day mix (afternoon solo)"].examples.length < 3)
          categories["Time-of-day mix (afternoon solo)"].examples.push(n.slice(0,60));
      } else {
        categories["EP/Character Demo (character CN + title EN)"].count++;
        if (categories["EP/Character Demo (character CN + title EN)"].examples.length < 2)
          categories["EP/Character Demo (character CN + title EN)"].examples.push(n.slice(0,60));
      }
    } else if (n.match(/Version \d|Teaser|Preview PV/) && n.includes(" - ")) {
      categories["Teaser/Version (EN format + CN song)"].count++;
      if (categories["Teaser/Version (EN format + CN song)"].examples.length < 2)
        categories["Teaser/Version (EN format + CN song)"].examples.push(n.slice(0,60));
    } else if (n.includes("战斗 scenario") || n.includes("战斗 situation")) {
      categories["Combat scenario mix (combat solo)"].count++;
      if (categories["Combat scenario mix (combat solo)"].examples.length < 3)
        categories["Combat scenario mix (combat solo)"].examples.push(n.slice(0,60));
    } else if (n.match(/委托\b|委托,|a 委托/)) {
      categories["Commission mix (委托 solo)"].count++;
      if (categories["Commission mix (委托 solo)"].examples.length < 3)
        categories["Commission mix (委托 solo)"].examples.push(n.slice(0,60));
    } else if (n.match(/Battle with|Battle against|Fight against|Fight with/)) {
      categories["Battle with/against mix"].count++;
      if (categories["Battle with/against mix"].examples.length < 3)
        categories["Battle with/against mix"].examples.push(n.slice(0,60));
    } else if (n.match(/advertisement in login screen/)) {
      categories["Advertisement nodes"].count++;
      if (categories["Advertisement nodes"].examples.length < 2)
        categories["Advertisement nodes"].examples.push(n.slice(0,60));
    } else if (n.match(/story scene|Story scenes|movie in/)) {
      categories["Movie in / featured in"].count++;
      if (categories["Movie in / featured in"].examples.length < 3)
        categories["Movie in / featured in"].examples.push(n.slice(0,60));
    } else if (n.match(/空洞|Hyper|Cretan|Lemnian|Ballet Twins|Outer Ring/)) {
      categories["Hollow/Cretan/Lemnian mix"].count++;
      if (categories["Hollow/Cretan/Lemnian mix"].examples.length < 3)
        categories["Hollow/Cretan/Lemnian mix"].examples.push(n.slice(0,60));
    } else if (n.match(/Season \d story|story scenes/)) {
      categories["Story scene mix (single CN word in EN sentence)"].count++;
      if (categories["Story scene mix (single CN word in EN sentence)"].examples.length < 3)
        categories["Story scene mix (single CN word in EN sentence)"].examples.push(n.slice(0,60));
    } else {
      categories["Other acceptable"].count++;
      if (categories["Other acceptable"].examples.length < 5)
        categories["Other acceptable"].examples.push(n.slice(0,60));
    }
  }

  console.log("=== 中英混搭节点分类 (共" + res.rows.length + "个) ===\n");
  let totalProblematic = 0;
  let totalAcceptable = 0;
  
  for (const [cat, data] of Object.entries(categories)) {
    if (data.count === 0) continue;
    const isAcceptable = ["EP/Character Demo (character CN + title EN)", "Teaser/Version (EN format + CN song)", "Other acceptable"].includes(cat);
    const tag = isAcceptable ? "✅ 可接受" : "🟡 需处理";
    if (isAcceptable) totalAcceptable += data.count;
    else totalProblematic += data.count;
    
    console.log(`${tag} ${cat}: ${data.count}个`);
    for (const ex of data.examples) console.log(`    → ${ex}`);
    if (data.count > data.examples.length) console.log(`    ... 等${data.count}个`);
    console.log();
  }

  console.log(`可接受: ${totalAcceptable} | 需处理: ${totalProblematic}`);
  await c.end();
}

main().catch(e => { console.error(e); process.exit(1); });
