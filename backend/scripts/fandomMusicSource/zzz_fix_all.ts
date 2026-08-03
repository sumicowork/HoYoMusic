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

  // ====== 1. Strip " - 绝区零" / " - Zenless Zone Zero" suffix ======
  console.log("=== 1. Strip trailing game name ===\n");
  const gc = await c.query(`
    SELECT mn.id, mn.name, mn.en_name FROM music_source_nodes mn 
    JOIN music_source_categories mc ON mc.id = mn.category_id WHERE mc.game_id = 3
  `);
  let fixedGame = 0;
  for (const r of gc.rows) {
    let ne = r.en_name;
    let nn = r.name;
    // Strip " - Zenless Zone Zero" from end
    ne = ne.replace(/\s*[-–—]\s*Zenless Zone Zero\s*$/, "").trim();
    // Strip " - 绝区零" from end (Chinese)
    nn = nn.replace(/\s*[-–—]\s*绝区零\s*$/, "").trim();
    if (ne !== r.en_name || nn !== r.name) {
      await c.query("UPDATE music_source_nodes SET en_name=$1, name=$2 WHERE id=$3", [ne, nn, r.id]);
      fixedGame++;
      if (fixedGame <= 10) console.log("  #"+r.id+": '" + r.name.slice(0,50) + "' → '" + nn.slice(0,50) + "'");
    }
  }
  console.log("  Fixed: " + fixedGame);

  // ====== 2. Strip remaining "| 绝区零" / "| XXX" pipes in Chinese nodes ======
  console.log("\n=== 2. Strip remaining pipes ===\n");
  const pc = await c.query(`
    SELECT mn.id, mn.name, mn.en_name FROM music_source_nodes mn 
    JOIN music_source_categories mc ON mc.id = mn.category_id WHERE mc.game_id = 3
  `);
  let fixedPipe = 0;
  for (const r of pc.rows) {
    let ne = r.en_name;
    let nn = r.name;
    ne = ne.replace(/\s*\|\s*Zenless Zone Zero.*$/, "").trim();
    ne = ne.replace(/\s*\|\s*[A-Z][a-z]+ Character (Demo|Showcase).*$/, "").trim();
    ne = ne.replace(/\s*\|\s*\d{4} Mix.*$/, "").trim();
    nn = nn.replace(/\s*\|\s*绝区零.*$/, "").trim(); 
    nn = nn.replace(/\s*\|\s*[^|]+角色展示.*$/, "").trim();
    nn = nn.replace(/\s*\|\s*[^|]+EP\s*$/, "").trim();
    nn = nn.replace(/\s*\|\s*丽都闪耀时.*$/, "").trim();
    nn = nn.replace(/\s*\|\s*序曲.*$/, "").trim();
    nn = nn.replace(/\s*\|\s*天使載入中.*$/, "").trim();
    if (ne !== r.en_name || nn !== r.name) {
      await c.query("UPDATE music_source_nodes SET en_name=$1, name=$2 WHERE id=$3", [ne, nn, r.id]);
      fixedPipe++;
      console.log("  #"+r.id+": '" + r.name.slice(0,50) + "' → '" + nn.slice(0,50) + "'");
    }
  }
  console.log("  Fixed: " + fixedPipe);

  // ====== 3. Fix wiki internal links ======
  console.log("\n=== 3. Fix wiki links ===\n");
  const wl = await c.query(`
    SELECT mn.id, mn.name, mn.en_name FROM music_source_nodes mn 
    JOIN music_source_categories mc ON mc.id = mn.category_id WHERE mc.game_id = 3
    AND (mn.name LIKE '%/Stages%' OR mn.en_name LIKE '%/Stages%')
  `);
  for (const r of wl.rows) {
    let nn = r.name.replace(/: .*?\/.*$/, ": " + r.name.split(": ")[1]?.split("/")[0] || "");
    let ne = r.en_name.replace(/: .*?\/.*$/, ": " + r.en_name.split(": ")[1]?.split("/")[0] || "");
    console.log("  #"+r.id+": '"+r.name.slice(0,60)+"' → '"+nn.slice(0,60)+"'");
    await c.query("UPDATE music_source_nodes SET en_name=$1, name=$2 WHERE id=$3", [ne, nn, r.id]);
  }

  // ====== 4. Delete truncated garbage (... fragments) ======
  console.log("\n=== 4. Delete truncated fragments ===\n");
  const tg = await c.query(`
    SELECT mn.id, mn.en_name FROM music_source_nodes mn 
    JOIN music_source_categories mc ON mc.id = mn.category_id WHERE mc.game_id = 3
    AND (mn.en_name LIKE '%...%' OR mn.en_name = 'M...' OR mn.en_name LIKE 'Congrats on finding the%')
  `);
  for (const r of tg.rows) {
    console.log("  DELETE #"+r.id+": '"+r.en_name+"'");
    await c.query("DELETE FROM track_music_sources WHERE node_id=$1", [r.id]);
    await c.query("DELETE FROM music_source_nodes WHERE id=$1", [r.id]);
  }
  console.log("  Deleted: " + tg.rows.length);

  // ====== 5. Fix nodes with unbalanced parens/quotes ======
  console.log("\n=== 5. Fix unbalanced parens/quotes ===\n");
  const uq = await c.query(`
    SELECT mn.id, mn.name, mn.en_name FROM music_source_nodes mn 
    JOIN music_source_categories mc ON mc.id = mn.category_id WHERE mc.game_id = 3
    AND (
      mn.name LIKE '%"%' AND char_length(mn.name)-char_length(replace(mn.name,'"','')) IN (1,3,5)
      OR mn.name LIKE '%"%' AND mn.name NOT LIKE '%" -%'
    )
  `);
  for (const r of uq.rows) {
    // Strip orphan trailing quotes
    let nn = r.name.replace(/"\s*$/, "").trim();
    console.log("  #"+r.id+": '"+r.name.slice(0,50)+"' → '"+nn.slice(0,50)+"'");
    await c.query("UPDATE music_source_nodes SET name=$1 WHERE id=$2", [nn, r.id]);
  }

  // Fix unbalanced parens
  const up = await c.query(`
    SELECT mn.id, mn.name, mn.en_name FROM music_source_nodes mn 
    JOIN music_source_categories mc ON mc.id = mn.category_id WHERE mc.game_id = 3
    AND (mn.name LIKE '%)' AND mn.name NOT LIKE '%(%' OR mn.name LIKE '%(%' AND mn.name NOT LIKE '%)')
  `);
  for (const r of up.rows) {
    console.log("  #"+r.id+": resetting '"+r.name+"' → en_name");
    await c.query("UPDATE music_source_nodes SET name=en_name WHERE id=$1", [r.id]);
  }

  // ====== 6. Deduplicate ======
  console.log("\n=== 6. Deduplicate ===\n");
  const dups = await c.query(`
    SELECT en_name, array_agg(id) as ids, count(*) as cnt FROM music_source_nodes mn 
    JOIN music_source_categories mc ON mc.id = mn.category_id WHERE mc.game_id = 3
    GROUP BY en_name HAVING count(*) > 1 ORDER BY cnt DESC
  `);
  let deduped = 0;
  for (const d of dups.rows) {
    if (d.ids.length <= 1) continue;
    // Keep the lowest ID, delete the rest
    const keep = d.ids[0];
    const del = d.ids.slice(1);
    if (del.length > 0) {
      console.log("  '"+d.en_name.slice(0,50)+"' x"+d.cnt+" keep #"+keep+" del "+del.join(","));
      for (const did of del) {
        await c.query("DELETE FROM track_music_sources WHERE node_id=$1", [did]);
        await c.query("DELETE FROM music_source_nodes WHERE id=$1", [did]);
        deduped++;
      }
    }
  }
  console.log("  Deduplicated: " + deduped);

  // ====== FINAL STATS ======
  const s = await c.query(`
    SELECT count(*) FROM music_source_nodes mn 
    JOIN music_source_categories mc ON mc.id = mn.category_id WHERE mc.game_id = 3
  `);
  console.log("\n=== DONE: "+s.rows[0].count+" nodes ===");
  await c.end();
}
main().catch(e => { console.error(e); process.exit(1); });
