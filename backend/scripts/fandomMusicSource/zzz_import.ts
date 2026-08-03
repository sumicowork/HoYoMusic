import { getWikitext, parseOtherLanguages } from "./fandomClient";
import { Client } from "pg";
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function main() {
  const client = new Client({
    host: process.env.DB_HOST || "127.0.0.1",
    port: parseInt(process.env.DB_PORT || "15433"),
    user: process.env.DB_USER || "sumicowork",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "hoyomusic",
  });
  await client.connect();

  const gameRes = await client.query("SELECT id FROM games WHERE name='绝区零'");
  if (gameRes.rowCount === 0) { console.log("ZZZ game not found"); return; }
  const gameId = gameRes.rows[0].id;

  const trackRes = await client.query(
    `SELECT t.id, t.title_en, t.title, t.title_cn FROM tracks t 
     JOIN albums a ON a.id = t.album_id 
     WHERE a.game_id = $1 AND t.title_en IS NOT NULL AND t.title_en != ''`,
    [gameId]
  );
  console.log(`ZZZ tracks with title_en: ${trackRes.rowCount}`);

  const catRes = await client.query("SELECT id, name FROM music_source_categories");
  const catByName = new Map<string, number>();
  for (const r of catRes.rows) catByName.set(r.name, r.id);

  const nodeRes = await client.query(
    "SELECT id, en_name, category_id FROM music_source_nodes WHERE game_id = $1",
    [gameId]
  );
  const nodeByKey = new Map<string, number>();
  for (const r of nodeRes.rows) {
    if (r.en_name) nodeByKey.set(`${r.category_id}|${r.en_name}`, r.id);
  }

  function parseFeaturedSources(rawValue: string): Array<{event: string, stage: string|null, raw: string}> {
    if (!rawValue) return [];
    const sources: Array<{event: string, stage: string|null, raw: string}> = [];
    const parts = rawValue.split(";;");
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.startsWith("[http") || trimmed.startsWith("http")) continue;
      if (!trimmed || trimmed.length < 2) continue;
      let cleaned = trimmed;
      cleaned = cleaned.replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, "$1");
      cleaned = cleaned.replace(/\[\[|\]\]/g, "").trim();
      if (!cleaned) continue;
      const colonIdx = cleaned.indexOf(":");
      if (colonIdx >= 0) {
        const eventPart = cleaned.substring(0, colonIdx).trim();
        const stagePart = cleaned.substring(colonIdx + 1).trim();
        const hashIdx = stagePart.lastIndexOf("#");
        if (hashIdx >= 0) {
          const sectionName = stagePart.substring(hashIdx + 1).trim();
          sources.push({ event: eventPart, stage: sectionName, raw: cleaned });
        } else {
          sources.push({ event: eventPart, stage: null, raw: cleaned });
        }
      } else {
        sources.push({ event: cleaned, stage: null, raw: cleaned });
      }
    }
    return sources;
  }

  let edges = 0, newNodes = 0, matched = 0, noPage = 0, noSource = 0;
  let batch = 0;

  for (const track of trackRes.rows) {
    const searchName = track.title_en;
    batch++;
    // Rate limit: pause every 5 requests
    if (batch % 5 === 0) await new Promise(r => setTimeout(r, 1500));
    
    try {
      // Retry up to 2 times on network errors
      let wikitext = "";
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          wikitext = await getWikitext("zenless-zone-zero", searchName);
          break;
        } catch (e: any) {
          if (attempt === 1 || (e.code !== 'ECONNRESET' && e.code !== 'ETIMEDOUT')) throw e;
          await new Promise(r => setTimeout(r, 3000));
        }
      }
      if (!wikitext) { noPage++; continue; }

      const featuredMatches = wikitext.match(/\|\s*featured\d?\s*=\s*(.+)/gi);
      if (!featuredMatches) { noSource++; continue; }

      matched++;
      for (const fm of featuredMatches) {
        const rawValue = fm.replace(/^\|\s*featured\d?\s*=\s*/, "").trim();
        const sources = parseFeaturedSources(rawValue);

        for (const src of sources) {
          let catName = "活动玩法";
          let catId: number | undefined = catByName.get(catName);
          if (!catId) {
            const insertCat = await client.query(
              "INSERT INTO music_source_categories (name) VALUES ($1) ON CONFLICT DO NOTHING RETURNING id",
              [catName]
            );
            catId = insertCat.rows[0]?.id || catByName.get(catName);
            if (catId) catByName.set(catName, catId);
          }
          if (!catId) continue;

          const eventKey = `${catId}|${src.event}`;
          let eventNodeId: number | undefined = nodeByKey.get(eventKey);
          if (!eventNodeId) {
            const insert = await client.query(
              "INSERT INTO music_source_nodes (game_id, category_id, en_name, name) VALUES ($1,$2,$3,$4) RETURNING id",
              [gameId, catId, src.event, src.event]
            );
            eventNodeId = insert.rows[0]?.id;
            if (eventNodeId) { nodeByKey.set(eventKey, eventNodeId); newNodes++; }
          }
          if (!eventNodeId) continue; // Safety guard

          let targetNodeId: number = eventNodeId;
          if (src.stage) {
            const stageKey = `${catId}|${src.stage}`;
            let stageNodeId: number | undefined = nodeByKey.get(stageKey);
            if (!stageNodeId) {
              const insert = await client.query(
                "INSERT INTO music_source_nodes (game_id, category_id, en_name, name, parent_id) VALUES ($1,$2,$3,$4,$5) RETURNING id",
                [gameId, catId, src.stage, src.stage, eventNodeId]
              );
              stageNodeId = insert.rows[0]?.id;
              if (stageNodeId) { nodeByKey.set(stageKey, stageNodeId); newNodes++; }
            }
            if (stageNodeId) targetNodeId = stageNodeId;
          }

          await client.query(
            "INSERT INTO track_music_sources (track_id, game_id, category_id, node_id) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING",
            [track.id, gameId, catId, targetNodeId]
          );
          edges++;
        }
      }

      try {
        const langs = parseOtherLanguages(wikitext);
        const zh = (langs as any).zhs || (langs as any).zht;
        if (zh && !track.title_cn) {
          await client.query("UPDATE tracks SET title_cn = $1 WHERE id = $2", [zh, track.id]);
        }
      } catch (e) { /* optional */ }

      process.stderr.write(".");
    } catch (e: any) {
      noPage++;
      // On connection errors, wait longer
      if (e.code === 'ECONNRESET' || e.code === 'ETIMEDOUT') {
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  }

  console.log(`\n\n=== ZZZ Music Source Import Results ===`);
  console.log(`Tracks checked: ${trackRes.rowCount}`);
  console.log(`Fandom page found: ${matched}`);
  console.log(`No page / error: ${noPage}`);
  console.log(`Has page but no source: ${noSource}`);
  console.log(`New nodes created: ${newNodes}`);
  console.log(`Edges inserted: ${edges}`);

  const verify = await client.query(
    `SELECT count(DISTINCT t.id) as tracks, count(DISTINCT tms.track_id) as with_source 
     FROM tracks t JOIN albums a ON a.id = t.album_id 
     LEFT JOIN track_music_sources tms ON tms.track_id = t.id 
     WHERE a.game_id = $1`, [gameId]
  );
  console.log(`\nZZZ Coverage: ${verify.rows[0].with_source}/${verify.rows[0].tracks} (${Math.round(verify.rows[0].with_source/verify.rows[0].tracks*100)}%)`);

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
