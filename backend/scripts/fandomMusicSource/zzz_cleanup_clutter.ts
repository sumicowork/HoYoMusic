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

  console.log("=== PASS 1: Strip YouTube channel clutter ===\n");
  // Pattern: " | Zenless Zone Zero" or " | 绝区零" at end of name/en_name
  const ytRes = await c.query(`
    SELECT mn.id, mn.name, mn.en_name FROM music_source_nodes mn 
    JOIN music_source_categories mc ON mc.id = mn.category_id 
    WHERE mc.game_id = 3 AND (mn.en_name LIKE '% | Zenless Zone Zero' OR mn.name LIKE '% | 绝区零')
  `);
  console.log(`Found ${ytRes.rows.length} nodes with YouTube channel clutter`);
  for (const r of ytRes.rows) {
    const newEname = r.en_name.replace(/\s*\|\s*Zenless Zone Zero\s*$/, "").replace(/\s*\|\s*Zenless Zone Zero\s*,/, " ,");
    const newName = r.name.replace(/\s*\|\s*绝区零\s*$/, "").replace(/\s*\|\s*绝区零\s*,/, " ,");
    console.log(`  #${r.id}: "${r.en_name.slice(0,60)}" → "${newEname.slice(0,60)}"`);
    await c.query("UPDATE music_source_nodes SET en_name = $1, name = $2 WHERE id = $3", [newEname, newName, r.id]);
  }

  console.log("\n=== PASS 2: Fix (Hollow) → [空洞] duplication ===\n");
  // "(Hollow) Timesworn Hills" → dict has "(Hollow)"→"[空洞]" and "Timesworn Hills"→"[空洞]昔丘"
  // Result: "[空洞] [空洞]昔丘" — duplicated!
  const dupRes = await c.query(`
    SELECT mn.id, mn.name, mn.en_name FROM music_source_nodes mn 
    JOIN music_source_categories mc ON mc.id = mn.category_id 
    WHERE mc.game_id = 3 AND (mn.name LIKE '%[空洞] [空洞]%' OR mn.en_name LIKE '%[空洞] [空洞]%')
  `);
  console.log(`Found ${dupRes.rows.length} nodes with [空洞] duplication`);
  for (const r of dupRes.rows) {
    const newName = r.name.replace(/\[空洞\]\s*\[空洞\]/g, "[空洞]");
    const newEname = r.en_name.replace(/\[空洞\]\s*\[空洞\]/g, "[空洞]");
    console.log(`  #${r.id}: "${r.name.slice(0,60)}" → "${newName.slice(0,60)}"`);
    await c.query("UPDATE music_source_nodes SET name = $1 WHERE id = $2", [newName, r.id]);
  }

  console.log("\n=== PASS 3: Fix 'and ' prefix residue ===\n");
  const andRes = await c.query(`
    SELECT mn.id, mn.name, mn.en_name FROM music_source_nodes mn 
    JOIN music_source_categories mc ON mc.id = mn.category_id 
    WHERE mc.game_id = 3 AND mn.en_name LIKE 'and %'
  `);
  console.log(`Found ${andRes.rows.length} nodes with 'and ' prefix`);
  for (const r of andRes.rows) {
    const newEname = r.en_name.replace(/^and /, "");
    const newName = r.name.replace(/^and /, "");
    console.log(`  #${r.id}: "${r.name.slice(0,50)}" → "${newName.slice(0,50)}"`);
    await c.query("UPDATE music_source_nodes SET en_name = $1, name = $2 WHERE id = $3", [newEname, newName, r.id]);
  }

  console.log("\n=== PASS 4: Delete useless N/A nodes ===\n");
  const naRes = await c.query(`
    SELECT mn.id, mn.name FROM music_source_nodes mn 
    JOIN music_source_categories mc ON mc.id = mn.category_id 
    WHERE mc.game_id = 3 AND mn.en_name = 'N/A'
  `);
  console.log(`Found ${naRes.rows.length} N/A nodes to delete`);
  for (const r of naRes.rows) {
    await c.query("DELETE FROM track_music_sources WHERE node_id = $1", [r.id]);
    await c.query("DELETE FROM music_source_nodes WHERE id = $1", [r.id]);
    console.log(`  Deleted #${r.id}`);
  }

  console.log("\n=== PASS 5: Clean up double spaces and trailing spaces ===\n");
  const spaceRes = await c.query(`
    UPDATE music_source_nodes SET name = regexp_replace(trim(name), ' {2,}', ' ', 'g'),
                                  en_name = regexp_replace(trim(en_name), ' {2,}', ' ', 'g')
    FROM music_source_categories mc WHERE mc.id = music_source_nodes.category_id AND mc.game_id = 3
  `);

  console.log("\n=== FINAL STATS ===");
  const stats = await c.query(`
    SELECT count(*) tot, count(*) FILTER(WHERE mn.name!=mn.en_name) tr
    FROM music_source_nodes mn JOIN music_source_categories mc ON mc.id=mn.category_id WHERE mc.game_id=3
  `);
  console.log(`Nodes: ${stats.rows[0].tot}, Translated: ${stats.rows[0].tr}`);

  await c.end();
}

main().catch(e => { console.error(e); process.exit(1); });
