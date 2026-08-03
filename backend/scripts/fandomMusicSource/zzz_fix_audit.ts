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

  // ==========================================
  // 🔴 PASS 1: Delete garbage nodes
  // ==========================================
  console.log("=== PASS 1: Delete garbage ===\n");
  
  // Fandom source code fragments
  const garbage = await c.query(`
    SELECT mn.id, mn.en_name FROM music_source_nodes mn 
    JOIN music_source_categories mc ON mc.id = mn.category_id 
    WHERE mc.game_id = 3 AND (
      mn.en_name LIKE '|youtube_id%' OR 
      mn.en_name LIKE '|featured%'
    )
  `);
  for (const r of garbage.rows) {
    console.log(`  DELETE #${r.id}: "${r.en_name}"`);
    await c.query("DELETE FROM track_music_sources WHERE node_id = $1", [r.id]);
    await c.query("DELETE FROM music_source_nodes WHERE id = $1", [r.id]);
  }
  console.log(`  Deleted ${garbage.rows.length} source code fragments`);

  // Emoji garbage
  const emoji = await c.query(
    "SELECT mn.id, mn.en_name FROM music_source_nodes mn " +
    "JOIN music_source_categories mc ON mc.id = mn.category_id " +
    "WHERE mc.game_id = 3 AND mn.id = 10749"
  );
  for (const r of emoji.rows) {
    console.log(`  DELETE #${r.id}: emoji message`);
    await c.query("DELETE FROM track_music_sources WHERE node_id = $1", [r.id]);
    await c.query("DELETE FROM music_source_nodes WHERE id = $1", [r.id]);
  }

  // Useless "Story scenes" standalone
  const useless = await c.query(`
    SELECT mn.id, mn.en_name FROM music_source_nodes mn 
    JOIN music_source_categories mc ON mc.id = mn.category_id 
    WHERE mc.game_id = 3 AND mn.en_name = 'Story scenes'
  `);
  for (const r of useless.rows) {
    console.log(`  DELETE #${r.id}: standalone 'Story scenes'`);
    await c.query("DELETE FROM track_music_sources WHERE node_id = $1", [r.id]);
    await c.query("DELETE FROM music_source_nodes WHERE id = $1", [r.id]);
  }
  console.log(`  Deleted ${useless.rows.length} useless standalone nodes`);

  // ==========================================
  // 🟠 PASS 2: Clean pipe clutter and suffixes
  // ==========================================
  console.log("\n=== PASS 2: Clean pipe/suffix clutter ===\n");

  // Find ALL nodes with pipe in en_name (not handled by previous cleanup)
  const pipeNodes = await c.query(`
    SELECT mn.id, mn.en_name, mn.name FROM music_source_nodes mn 
    JOIN music_source_categories mc ON mc.id = mn.category_id 
    WHERE mc.game_id = 3 AND mn.en_name LIKE '% | %'
  `);
  console.log(`  ${pipeNodes.rows.length} nodes with pipe in en_name`);
  for (const r of pipeNodes.rows) {
    // Strip " | Zenless Zone Zero" and similar patterns from en_name
    let newEname = r.en_name.replace(/\s*\|\s*Zenless Zone Zero(\s+[A-Z].*)?$/, "");
    // Also strip " , Rhythm Rave" / " , 音跃狂潮" suffixes
    newEname = newEname.replace(/\s*,\s*Rhythm Rave\s*$/, "");
    newEname = newEname.trim();
    
    let newName = r.name.replace(/\s*\|\s*绝区零(\s+[^,]+.*)?$/, "");
    newName = newName.replace(/\s*,\s*音跃狂潮\s*$/, "");
    newName = newName.trim();
    
    if (newEname !== r.en_name || newName !== r.name) {
      console.log(`  #${r.id}: "${r.name.slice(0,60)}" → "${newName.slice(0,60)}"`);
      await c.query("UPDATE music_source_nodes SET en_name = $1, name = $2 WHERE id = $3", [newEname, newName, r.id]);
    }
  }

  // Find nodes with " , 音跃狂潮" in name (trailing clutter)
  const suffixNodes = await c.query(`
    SELECT mn.id, mn.name, mn.en_name FROM music_source_nodes mn 
    JOIN music_source_categories mc ON mc.id = mn.category_id 
    WHERE mc.game_id = 3 AND (mn.name LIKE '%, 音跃狂潮%' OR mn.en_name LIKE '%, Rhythm Rave%')
  `);
  console.log(`\n  ${suffixNodes.rows.length} nodes with , 音跃狂潮/Rhythm Rave suffix`);
  for (const r of suffixNodes.rows) {
    const newName = r.name.replace(/\s*,\s*音跃狂潮\s*/g, "").trim();
    const newEname = r.en_name.replace(/\s*,\s*Rhythm Rave\s*/g, "").trim();
    console.log(`  #${r.id}: "${r.name.slice(0,60)}" → "${newName.slice(0,60)}"`);
    await c.query("UPDATE music_source_nodes SET en_name = $1, name = $2 WHERE id = $3", [newEname, newName, r.id]);
  }

  // ==========================================
  // 🟠 PASS 3: Fix [空洞] duplication in dictionary
  // ==========================================
  console.log("\n=== PASS 3: Fix [空洞] dicrionary duplication ===\n");
  
  // The root cause: "(Hollow)" → "[空洞]" adds prefix, then location name also has "[空洞]"
  // Fix: change "(Hollow)" to strip without adding [空洞]
  // We'll do this by updating nodes where name has double [空洞]
  const dupNodes = await c.query(`
    SELECT mn.id, mn.name FROM music_source_nodes mn 
    JOIN music_source_categories mc ON mc.id = mn.category_id 
    WHERE mc.game_id = 3 AND mn.name LIKE '%[空洞] [空洞]%'
  `);
  console.log(`  ${dupNodes.rows.length} nodes with [空洞] duplication`);
  for (const r of dupNodes.rows) {
    const newName = r.name.replace(/\[空洞\]\s*\[空洞\]/g, "[空洞]");
    console.log(`  #${r.id}: "${r.name}" → "${newName}"`);
    await c.query("UPDATE music_source_nodes SET name = $1 WHERE id = $2", [newName, r.id]);
  }

  // ==========================================
  // 🟠 PASS 4: Fix truncated quotes
  // ==========================================
  console.log("\n=== PASS 4: Fix truncated quotes ===\n");
  const quoteNodes = await c.query(`
    SELECT mn.id, mn.name, mn.en_name FROM music_source_nodes mn 
    JOIN music_source_categories mc ON mc.id = mn.category_id 
    WHERE mc.game_id = 3 AND (
      mn.name LIKE '%"My Curse' OR
      mn.name LIKE '%"自导自演' OR
      mn.name LIKE '%"Unknown Area' OR
      mn.name LIKE '%"Uniform' OR
      mn.name LIKE '%"青童与白叟'
    )
  `);
  for (const r of quoteNodes.rows) {
    const fixed = r.en_name;  // Reset to original English
    console.log(`  #${r.id}: "${r.name}" → "${fixed}"`);
    await c.query("UPDATE music_source_nodes SET name = en_name WHERE id = $1", [r.id]);
  }

  // ==========================================
  // 🟡 PASS 5: Remove isolated "combat" from dictionary
  // (Defer to dict edit - handled separately)
  // ==========================================

  // ==========================================
  // FINAL: Stats
  // ==========================================
  const stats = await c.query(`
    SELECT count(*) tot FROM music_source_nodes mn 
    JOIN music_source_categories mc ON mc.id = mn.category_id WHERE mc.game_id = 3
  `);
  console.log(`\n=== DONE ===`);
  console.log(`Remaining nodes: ${stats.rows[0].tot}`);

  await c.end();
}

main().catch(e => { console.error(e); process.exit(1); });
