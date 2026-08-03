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
    "SELECT mn.name, mn.en_name FROM music_source_nodes mn JOIN music_source_categories mc ON mc.id=mn.category_id WHERE mc.game_id=3 AND mn.name ~ '[A-Za-z]{4,}' ORDER BY mn.name"
  );

  let total = 0;
  let readable = 0;
  const needsFix: string[] = [];

  for (const row of r.rows) {
    total++;
    const n: string = row.name;
    
    // "英文即中文" 类别 — 中文用户自然接受的英文
    const isOfficialEN = 
      n.match(/EP - "((Tiny Giant|pinKing|Fearless|DAMIDAMI|ReDreaming Angel|FURY ON|My Curse, My Fate|Billy Mode|chaos\.exe|ZENLESS|BITE!))"/) ||
      n.match(/EP – "((Tiny Giant|pinKing|Fearless|DAMIDAMI|ReDreaming Angel|FURY ON|Burning Desires|Stars Align|BITE!))"/) ||
      n.includes("Burning Desires") && n.includes("绝望吧台") ||
      n.includes("Stars Align") && n.includes("当群星交汇") ||
      n.includes("FURYON") && n.includes("狂怒觉醒") ||
      n.includes("BITE!") && n.includes("咬合力");

    // Format markers that Chinese gamers understand
    const isFormatMarker = 
      n.match(/^(.*?)(EP|MV|Character Demo|Teaser|Animated Short Film)\b/) ||
      n.match(/\b(EP|MV|Character Demo|Teaser|Animated Short Film|HDD)\b/);

    // Time/location descriptors (no wiki translations exist)
    const isTimeLoc = 
      n.match(/\(.*(during|weekdays|weekends|morning|afternoon|evening|midnight|City|TV Mode|Main Menu|Ranking Theme|Selection Menu).*\)/);

    // battle/combat remaining
    const isBattleCombat =
      n.match(/^Battle (with|against) /) ||
      n.match(/^Every combat scenario/) ||
      n.match(/^Combat scenarios/) ||
      n.match(/^Combat Simulation/) ||
      n.match(/^Second phase of the fight/);

    // advertisement nodes
    const isAd = n.includes("advertisement in login screen");
    // story scenes
    const isStory = n.includes("story scene");

    // Other clear proper names
    const isProperName =
      n.match(/^Business x Strangeness/) ||
      n.match(/^"En-Nah"/) ||
      n.match(/^Ultimate:/) ||
      n.match(/^Special Attack:/) ||
      n.match(/^Soul of Steel/) ||
      n.match(/^Tales of Midsummer/) ||
      n.match(/^Ether Tuning Challenge/) ||
      n.match(/^Polarity Calibration/) ||
      n.match(/^Grand Marcel Maze/) ||
      n.match(/March On|Counting Bangboo|Recommendation Events|Breaded Belief/);

    if (isOfficialEN || isFormatMarker || isTimeLoc || isBattleCombat || isAd || isStory || isProperName) {
      readable++;
    } else {
      needsFix.push(n.slice(0, 80));
    }
  }

  console.log("=== ZZZ 真实中文可读率 ===");
  console.log("含英文节点总数:", total);
  console.log("中文用户可自然阅读:", readable, "(" + (total > 0 ? Math.round(100 * readable / total) : 0) + "% of EN nodes)");

  const allNodes = (await c.query(
    "SELECT count(*) FROM music_source_nodes mn JOIN music_source_categories mc ON mc.id=mn.category_id WHERE mc.game_id=3"
  )).rows[0].count;
  const fullyCN = allNodes - total;
  const trulyReadable = fullyCN + readable;
  console.log("全中文节点:", fullyCN);
  console.log("真实可读节点:", trulyReadable, "/", allNodes, "(" + Math.round(100 * trulyReadable / allNodes) + "%)");
  
  console.log("\n仍需翻译的节点(" + needsFix.length + "个):");
  for (const n of needsFix.slice(0, 20)) console.log("  ", n);
  if (needsFix.length > 20) console.log("  ... 等" + needsFix.length + "个");

  await c.end();
}
main().catch(e => { console.error(e); process.exit(1); });
