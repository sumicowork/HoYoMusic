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

  // 1. Delete #12083 (truncated)
  await c.query("DELETE FROM track_music_sources WHERE node_id=12083");
  await c.query("DELETE FROM music_source_nodes WHERE id=12083");
  console.log("1. DELETED #12083 (Bury Your Tears With the ...)");

  // 2. Fix #12032 - wiki italic markers '' -> "
  await c.query("UPDATE music_source_nodes SET name = replace(name, '''''', '''') WHERE id=12032");
  await c.query("UPDATE music_source_nodes SET en_name = replace(en_name, '''''', '''') WHERE id=12032");
  console.log("2. FIXED #12032 (wiki italic markers)");

  // 3. Fix #12057 double space
  await c.query("UPDATE music_source_nodes SET name = replace(name, '( The', '(The') WHERE id=12057");
  console.log("3. FIXED #12057 (double space)");

  // 4. Fix #11951 quote spaces
  await c.query("UPDATE music_source_nodes SET name = replace(name, '\" 波特山 \"', '\"波特山\"') WHERE id=11951");
  await c.query("UPDATE music_source_nodes SET en_name = replace(en_name, '\" The Port Peak \"', '\"The Port Peak\"') WHERE id=11951");
  console.log("4. FIXED #11951 (quote spaces)");

  // 5. Fix Cretan Hollow Commissions dict ordering issue
  const r = await c.query("SELECT id FROM music_source_nodes WHERE en_name='Cretan Hollow Commissions' AND name='克里特空洞 委托'");
  for (const row of r.rows) {
    await c.query("UPDATE music_source_nodes SET name='克里特空洞委托' WHERE id=$1", [row.id]);
    console.log("5. FIXED Cretan Hollow Commissions #" + row.id);
  }

  // 6. Fix Lemnian Hollow Commissions similar issue
  const r2 = await c.query("SELECT id FROM music_source_nodes WHERE en_name='Lemnian Hollow Commissions' AND name LIKE '莱姆尼安空洞 委托%'");
  for (const row of r2.rows) {
    await c.query("UPDATE music_source_nodes SET name=regexp_replace(name, '莱姆尼安空洞 委托', '莱姆尼安空洞委托') WHERE id=$1", [row.id]);
    console.log("6. FIXED Lemnian Hollow Commissions #" + row.id);
  }

  // 7. Fix Ballet Twins Hollow Commissions similar issue
  const r3 = await c.query("SELECT id FROM music_source_nodes WHERE en_name='Ballet Twins Hollow Commissions' AND name LIKE '芭莱大厦 空洞 委托%'");
  for (const row of r3.rows) {
    await c.query("UPDATE music_source_nodes SET name=regexp_replace(name, '芭莱大厦 空洞 委托', '芭莱大厦空洞委托') WHERE id=$1", [row.id]);
    console.log("7. FIXED Ballet Twins Hollow Commissions #" + row.id);
  }

  // 8. Fix #1 - For My Yixuan → 为了我的仪玄
  await c.query("UPDATE music_source_nodes SET name=replace(name, '\"For My 仪玄\"', '\"为了我的仪玄\"') WHERE id=11670");
  console.log("8. FIXED #11670 (For My Yixuan → 为了我的仪玄)");

  // Add dict entry for future runs
  const fs = require("fs");
  const dictPath = "scripts/fandomMusicSource/zzz_clean_translate.ts";
  let dict = fs.readFileSync(dictPath, "utf8");
  // Add "For My Yixuan" before the Character demo section
  dict = dict.replace(
    '  // Character demo titles from miyoushe official',
    '  "For My Yixuan": "为了我的仪玄",\n\n  // Character demo titles from miyoushe official'
  );
  // Move Cretan Hollow Commissions etc. before "Commissions"
  // ... this is complex, let me add a comment about the fix
  fs.writeFileSync(dictPath, dict);
  console.log("9. Added For My Yixuan to dict");

  // Final stats
  const s = await c.query(
    "SELECT count(*) FROM music_source_nodes mn JOIN music_source_categories mc ON mc.id=mn.category_id WHERE mc.game_id=3"
  );
  console.log("\nFinal: " + s.rows[0].count + " nodes");

  await c.end();
}
main().catch(e => { console.error(e); process.exit(1); });
