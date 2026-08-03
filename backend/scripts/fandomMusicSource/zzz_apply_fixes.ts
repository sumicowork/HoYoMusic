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

  // 1. Delete trash nodes
  const trash = ["M...", "Do Not Go Gentle Into That G...", "Bury Your Tears With t...",
    "Where Clouds Embr...", "将眼泪与过往一同埋葬 (...", "Where Clouds Embrace...", "The Impendi...",
    "Do Not Go Gentle Into That Good...", "Where Clouds Embrace the...", "Do Not Go Gentle...",
    "The Impend...", "An Incomplete Story )", "莱姆尼安空洞 ( Lurking Menace in the Shadows",
    "Story scenes", "Congrats on finding the \"performance easter egg\" that only the luckiest D...",
    "Congrats on finding the \"performance easter egg\" that only the luckiest Delulus can discover~"
  ];

  for (const t of trash) {
    const r = await c.query("SELECT id FROM music_source_nodes WHERE name = $1", [t]);
    for (const row of r.rows) {
      await c.query("DELETE FROM track_music_sources WHERE node_id = $1", [row.id]);
      await c.query("DELETE FROM music_source_nodes WHERE id = $1", [row.id]);
      console.log("DELETED: " + t.slice(0,50));
    }
  }

  // 2. Fix wiki links
  await c.query("UPDATE music_source_nodes SET name = regexp_replace(name, ':.+/Stages#', ': ') WHERE name LIKE '%/Stages#%'");
  await c.query("UPDATE music_source_nodes SET en_name = regexp_replace(en_name, ':.+/Stages#', ': ') WHERE en_name LIKE '%/Stages#%'");

  // 3. Fix space before 's
  const spaceNodes = await c.query(
    "SELECT id, name FROM music_source_nodes WHERE name LIKE '% ''s%' OR name LIKE '% '' s%'"
  );
  for (const r of spaceNodes.rows) {
    const fixed = r.name.replace(/\s+'s\b/g, "'s").replace(/\s+'\s+s\b/g, "'s");
    if (fixed !== r.name) {
      await c.query("UPDATE music_source_nodes SET name = $1 WHERE id = $2", [fixed, r.id]);
      console.log("FIXED space: " + r.name.slice(0,50) + " -> " + fixed.slice(0,50));
    }
  }

  // 4. Fix double space after (
  await c.query("UPDATE music_source_nodes SET name = replace(name, ' ( ', ' (') WHERE name LIKE '% ( %'");

  // 5. Fix trailing space before )
  await c.query("UPDATE music_source_nodes SET name = regexp_replace(name, '\\\\s+\\\\)', ')') WHERE name ~ '\\\\s+\\\\)'");

  // 6. Fix double single quotes (wiki italic marker)
  await c.query("UPDATE music_source_nodes SET name = replace(name, '''''', '''') WHERE name LIKE '%''''%'");
  await c.query("UPDATE music_source_nodes SET en_name = replace(en_name, '''''', '''') WHERE en_name LIKE '%''''%'");

  // 7. Fix " 波特山 " (extra spaces inside quotes)
  await c.query("UPDATE music_source_nodes SET name = replace(name, '\" ', '\"') WHERE name LIKE '%\" %'");
  await c.query("UPDATE music_source_nodes SET name = replace(name, ' \"', '\"') WHERE name LIKE '% \"%'");

  // Stats
  const s = await c.query(
    "SELECT count(*) FROM music_source_nodes mn JOIN music_source_categories mc ON mc.id = mn.category_id WHERE mc.game_id = 3"
  );
  console.log("\nRemaining: " + s.rows[0].count);

  await c.end();
}
main().catch(e => { console.error(e); process.exit(1); });
