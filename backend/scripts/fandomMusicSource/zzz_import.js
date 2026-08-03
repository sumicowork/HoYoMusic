/**
 * ZZZ Fandom Music Source 适配器
 * 从 zenless-zone-zero.fandom.com 抓取曲目的场景使用数据
 * ZZZ wiki 的特点：场景来源在 infobox 的 featured/featured2/featured3 字段中
 * 格式：Event Name: Event Name/Stages#Stage Name
 */
const path = require("path");
const fs = require("fs");

async function main() {
  const pg = require(path.resolve(__dirname, "../../node_modules/pg"));
  const Client = pg.Client;
  const dotenv = require(path.resolve(__dirname, "../../node_modules/dotenv"));
  dotenv.config({ path: path.resolve(__dirname, "../../.env") });

  const client = new Client({
    host: process.env.DB_HOST || "127.0.0.1",
    port: parseInt(process.env.DB_PORT || "15433"),
    user: process.env.DB_USER || "sumicowork",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "hoyomusic",
  });
  await client.connect();

  // 1. Get ZZZ game ID
  const gameRes = await client.query("SELECT id FROM games WHERE name='绝区零'");
  if (gameRes.rowCount === 0) { console.log("ZZZ game not found"); return; }
  const gameId = gameRes.rows[0].id;

  // 2. Get ZZZ tracks with title_en
  const trackRes = await client.query(
    `SELECT t.id, t.title_en, t.title, t.title_cn FROM tracks t 
     JOIN albums a ON a.id = t.album_id 
     WHERE a.game_id = $1 AND t.title_en IS NOT NULL AND t.title_en != ''`,
    [gameId]
  );
  console.log(`ZZZ tracks with title_en: ${trackRes.rowCount}`);

  // 3. Get existing music source categories for ZZZ
  const catRes = await client.query(
    "SELECT id, name FROM music_source_categories"
  );
  const catByName = new Map();
  for (const r of catRes.rows) catByName.set(r.name, r.id);

  // 4. Get existing nodes for ZZZ
  const nodeRes = await client.query(
    "SELECT id, en_name, name, parent_id, category_id FROM music_source_nodes WHERE game_id = $1",
    [gameId]
  );
  const nodeByKey = new Map(); // "catId|enName" -> id
  for (const r of nodeRes.rows) {
    if (r.en_name) nodeByKey.set(`${r.category_id}|${r.en_name}`, r.id);
  }

  // 5. Parse featured field to extract scene hierarchy
  function parseFeaturedSources(rawValue) {
    if (!rawValue) return [];
    const sources = [];
    // Split on ;; to separate YouTube link from game source
    const parts = rawValue.split(";;");
    for (const part of parts) {
      const trimmed = part.trim();
      // Skip YouTube/HTTP links
      if (trimmed.startsWith("[http") || trimmed.startsWith("http")) continue;
      if (!trimmed || trimmed.length < 2) continue;
      // Clean wiki markup: [[Page Name]] or [[Page Name|Display Name]]
      let cleaned = trimmed;
      // Replace [[A/B#C|D]] -> A/B#C
      cleaned = cleaned.replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, "$1");
      cleaned = cleaned.replace(/\[\[|\]\]/g, "").trim();
      if (!cleaned) continue;

      // Parse hierarchy from "Event Name: Stages#Stage Name" or "Event Name" pattern
      const colonIdx = cleaned.indexOf(":");
      if (colonIdx >= 0) {
        const eventPart = cleaned.substring(0, colonIdx).trim();
        const stagePart = cleaned.substring(colonIdx + 1).trim();
        // Stage part: "A Harmony of Delusions/Stages#Stream Rehearsal"
        const hashIdx = stagePart.lastIndexOf("#");
        if (hashIdx >= 0) {
          const sectionName = stagePart.substring(hashIdx + 1).trim();
          sources.push({ event: eventPart, stage: sectionName, raw: cleaned });
        } else {
          sources.push({ event: eventPart, stage: null, label: stagePart, raw: cleaned });
        }
      } else {
        sources.push({ event: cleaned, stage: null, raw: cleaned });
      }
    }
    return sources;
  }

  // Also get ZZZ wiki translations for nodes

  let edges = 0, newNodes = 0, matched = 0, noPage = 0, noSource = 0;

  for (const track of trackRes.rows) {
    const searchName = track.title_en;
    try {
      const wikitext = await getWikitext("zenless-zone-zero", searchName);
      if (!wikitext) { noPage++; continue; }

      // Extract featured fields from infobox
      const featuredMatches = wikitext.match(/\|\s*featured\d?\s*=\s*(.+)/gi);
      if (!featuredMatches) { noSource++; continue; }

      matched++;
      for (const fm of featuredMatches) {
        const rawValue = fm.replace(/^\|\s*featured\d?\s*=\s*/, "").trim();
        const sources = parseFeaturedSources(rawValue);

        for (const src of sources) {
          // Category is based on event type
          let catName = "活动玩法"; // default
          let catId = catByName.get(catName);
          if (!catId) {
            const insertCat = await client.query(
              "INSERT INTO music_source_categories (name) VALUES ($1) ON CONFLICT DO NOTHING RETURNING id",
              [catName]
            );
            catId = insertCat.rows[0]?.id || catByName.get(catName);
            catByName.set(catName, catId);
          }

          // Create/ensure event parent node
          const eventKey = `${catId}|${src.event}`;
          let eventNodeId = nodeByKey.get(eventKey);
          if (!eventNodeId) {
            const insert = await client.query(
              "INSERT INTO music_source_nodes (game_id, category_id, en_name, name) VALUES ($1,$2,$3,$4) RETURNING id",
              [gameId, catId, src.event, src.event]
            );
            eventNodeId = insert.rows[0].id;
            nodeByKey.set(eventKey, eventNodeId);
            newNodes++;
          }

          let targetNodeId = eventNodeId;
          if (src.stage) {
            const stageKey = `${catId}|${src.stage}`;
            let stageNodeId = nodeByKey.get(stageKey);
            if (!stageNodeId) {
              const insert = await client.query(
                "INSERT INTO music_source_nodes (game_id, category_id, en_name, name, parent_id) VALUES ($1,$2,$3,$4,$5) RETURNING id",
                [gameId, catId, src.stage, src.stage, eventNodeId]
              );
              stageNodeId = insert.rows[0].id;
              nodeByKey.set(stageKey, stageNodeId);
              newNodes++;
            }
            targetNodeId = stageNodeId;
          }

          // Create edge
          await client.query(
            "INSERT INTO track_music_sources (track_id, game_id, category_id, node_id) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING",
            [track.id, gameId, catId, targetNodeId]
          );
          edges++;
        }
      }

      // Also try to get Chinese translations for nodes
      try {
        const langs = parseOtherLanguages(wikitext);
        const zh = langs.zhs || langs.zht;
        if (zh) {
          await client.query(
            "UPDATE tracks SET title_cn = COALESCE(title_cn, $1) WHERE id = $2",
            [zh, track.id]
          );
        }
      } catch (e) { /* translation optional */ }

      process.stderr.write(".");
    } catch (e) {
      noPage++;
    }
  }

  console.log(`\n\n=== ZZZ Music Source Import Results ===`);
  console.log(`Tracks checked: ${trackRes.rowCount}`);
  console.log(`Fandom page found: ${matched}`);
  console.log(`No page / error: ${noPage}`);
  console.log(`Has page but no source: ${noSource}`);
  console.log(`New nodes created: ${newNodes}`);
  console.log(`Edges inserted: ${edges}`);

  // Verify
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
