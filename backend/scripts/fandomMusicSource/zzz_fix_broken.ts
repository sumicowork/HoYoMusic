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

  // 1. Delete garbage "featured3 =" nodes
  const garbage = await c.query(`
    SELECT mn.id, mn.name FROM music_source_nodes mn 
    JOIN music_source_categories mc ON mc.id = mn.category_id 
    WHERE mc.game_id = 3 AND mn.en_name LIKE 'featured3%'
  `);
  console.log("Garbage nodes to delete:", garbage.rows.map((r: any) => r.id));
  for (const r of garbage.rows) {
    await c.query("DELETE FROM track_music_sources WHERE node_id = $1", [r.id]);
    await c.query("DELETE FROM music_source_nodes WHERE id = $1", [r.id]);
  }
  console.log(`Deleted ${garbage.rows.length} garbage nodes`);

  // 2. Fix truncated nodes with unmatched double quotes
  const broken = await c.query(`
    SELECT mn.id, mn.name, mn.en_name FROM music_source_nodes mn 
    JOIN music_source_categories mc ON mc.id = mn.category_id 
    WHERE mc.game_id = 3 
    AND length(replace(mn.name, '"', '')) != length(mn.name) - (SELECT count(*) FROM regexp_matches(mn.name, '"', 'g'))
  `);
  
  // Simpler approach: check odd quote count
  const broken2 = await c.query(`
    SELECT mn.id, mn.name, mn.en_name FROM music_source_nodes mn 
    JOIN music_source_categories mc ON mc.id = mn.category_id 
    WHERE mc.game_id = 3 
    AND char_length(mn.name) - char_length(replace(mn.name, '"', '')) IN (1, 3, 5)
  `);
  
  console.log(`\nNodes with unmatched quotes: ${broken2.rows.length}`);
  for (const r of broken2.rows) {
    console.log(`  #${r.id}: "${r.name.slice(0,60)}" → "${r.en_name.slice(0,60)}"`);
    await c.query("UPDATE music_source_nodes SET name = en_name WHERE id = $1", [r.id]);
  }

  // 3. Fix unbalanced parens  
  const broken3 = await c.query(`
    SELECT mn.id, mn.name, mn.en_name FROM music_source_nodes mn 
    JOIN music_source_categories mc ON mc.id = mn.category_id 
    WHERE mc.game_id = 3 
    AND (
      char_length(mn.name) - char_length(replace(mn.name, '(', '')) != 
      char_length(mn.name) - char_length(replace(mn.name, ')', ''))
    )
  `);
  
  console.log(`\nNodes with unbalanced parens: ${broken3.rows.length}`);
  for (const r of broken3.rows) {
    console.log(`  #${r.id}: "${r.name.slice(0,60)}" → "${r.en_name.slice(0,60)}"`);
    await c.query("UPDATE music_source_nodes SET name = en_name WHERE id = $1", [r.id]);
  }

  const s = await c.query(`
    SELECT count(*) FROM music_source_nodes mn 
    JOIN music_source_categories mc ON mc.id = mn.category_id 
    WHERE mc.game_id = 3
  `);
  console.log(`\nRemaining nodes: ${s.rows[0].count}`);

  await c.end();
}

main().catch(e => { console.error(e); process.exit(1); });
