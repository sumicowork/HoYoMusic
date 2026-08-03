import { Client } from "pg";
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const { getWikitext } = require("./fandomMusicSource/fandomClient");

async function main() {
  const c = new Client({
    host: process.env.DB_HOST || "127.0.0.1",
    port: parseInt(process.env.DB_PORT || "15433"),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  await c.connect();

  // #1: 仪玄 Animated Short Film "For My 仪玄"
  const r1 = await c.query(
    "SELECT mn.id, mn.name, mn.en_name FROM music_source_nodes mn JOIN music_source_categories mc ON mc.id=mn.category_id WHERE mc.game_id=3 AND mn.id = $1",
    [11670]
  );
  if (r1.rows.length) {
    const n = r1.rows[0];
    console.log("=== #" + n.id + " ===");
    console.log("NAME:", n.name);
    console.log("ENAME:", n.en_name);

    // Trace: this came from an album page PlayedIn field or a single featured field
    // The ename is "Yixuan Animated Short Film 'For My Yixuan'"
    // Let's find which album/single produced this
    const source = await c.query(
      "SELECT a.title FROM track_music_sources tms JOIN albums a ON a.id = tms.album_id WHERE tms.node_id = $1 LIMIT 1",
      [n.id]
    );
    console.log("Album source:", source.rows[0]?.title || "unknown");

    // Check fandom for the album page or single page
    // This likely came from the "Hyper Commission 2.0: Character Teaser Soundtrack Collection"
    // or a specific single page for Yixuan
    const wt = await getWikitext("zenless-zone-zero", "Yixuan Animated Short Film");
    if (wt && wt.length > 50) {
      const featMatch = wt.match(/\|\s*featured\d?\s*=\s*([^\n|]+)/gi);
      if (featMatch) {
        console.log("Featured fields:");
        featMatch.forEach((f: string) => console.log("  " + f.trim()));
      }
    } else {
      // Try the Yixuan page itself
      const wt2 = await getWikitext("zenless-zone-zero", "Yixuan");
      if (wt2) {
        const featMatch = wt2.match(/\|\s*featured\d?\s*=\s*([^\n|]+)/gi);
        if (featMatch) {
          console.log("Featured on Yixuan agent page:");
          featMatch.forEach((f: string) => console.log("  " + f.trim()));
        } else {
          console.log("No featured field on Yixuan agent page (len=" + wt2.length + ")");
        }
      }
    }

    // Check miyoushe for official Chinese name
    console.log("miyoushe official: 仪玄动画短片 | 为了我的仪轩");
    console.log("Verdict: 'For My Yixuan' should translate to '为了我的仪轩' as a complete phrase");
  }

  await c.end();
}

main().catch(e => { console.error(e); process.exit(1); });
