import { Client } from "pg";
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function splitSources(text: string): string[] {
  const parts: string[] = [];
  // Split by `;;` first (always a content boundary)
  const semiSplit = text.split(/;;\s*/);
  
  for (const segment of semiSplit) {
    // Now split by ` , ` but ONLY outside quoted strings
    // Commas inside "quotes" are part of the content (e.g. "My Curse, My Fate")
    const commaSplit = splitCommasOutsideQuotes(segment.trim());
    for (const p of commaSplit) {
      const trimmed = p.trim();
      if (!trimmed || trimmed.length <= 1 || trimmed.length > 200) continue;
      // Clean wiki italic and normalize
      let clean = trimmed.replace(/\'\'([^\']+)\'\'/g, "'$1'");
      clean = clean.replace(/\s{2,}/g, " ").trim();
      if (clean === "Zenless Zone Zero") continue;
      if (/^\[\[[^\]]+\]\]$/.test(clean)) continue;
      if (/^[A-Z][a-z]+$/.test(clean) && clean.length <= 12) continue;
      if (/^Rhythm Rave$/.test(clean)) continue;
      // Reject truncation
      if (clean.endsWith("...") || clean.length < 5) continue;
      parts.push(clean);
    }
  }
  return parts;
}

/** Split by ` , ` only OUTSIDE double-quoted strings */
function splitCommasOutsideQuotes(text: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      inQuote = !inQuote;
      current += ch;
    } else if (!inQuote && text.slice(i).startsWith(" , ")) {
      // Comma-space-comma outside quotes → split point
      if (current.trim()) result.push(current.trim());
      current = "";
      i += 2; // skip " , "
    } else if (!inQuote && ch === ',' && (i === text.length - 1 || text[i+1] === ' ')) {
      // Single comma outside quotes → split point
      if (current.trim()) result.push(current.trim());
      current = "";
      // skip the space after comma if present
      if (i + 1 < text.length && text[i+1] === ' ') i++;
    } else {
      current += ch;
    }
  }
  if (current.trim()) result.push(current.trim());
  return result;
}

async function main() {
  const client = new Client({
    host: process.env.DB_HOST || "127.0.0.1",
    port: parseInt(process.env.DB_PORT || "15433"),
    user: process.env.DB_USER || "sumicowork",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "hoyomusic",
  });
  await client.connect();

  // Get all compound nodes with their track associations
  const nodes = await client.query(
    `SELECT mn.id as node_id, mn.en_name, mn.name, mn.game_id, mn.category_id, mn.parent_id,
            array_agg(DISTINCT tms.track_id) as track_ids
     FROM music_source_nodes mn
     JOIN music_source_categories mc ON mc.id = mn.category_id
     LEFT JOIN track_music_sources tms ON tms.node_id = mn.id
     WHERE mc.game_id = 3 AND (mn.en_name LIKE '% , %' OR mn.en_name LIKE '%|%' OR mn.en_name LIKE '%;;%')
     GROUP BY mn.id, mn.en_name, mn.name, mn.game_id, mn.category_id, mn.parent_id`
  );
  console.log(`Compound nodes to split: ${nodes.rowCount}`);

  // Phase 1: Count how many split nodes we'd create
  let totalParts = 0;
  let newNodeCount = 0;
  let newEdgeCount = 0;
  let deletedNodes = 0;

  for (const node of nodes.rows) {
    const parts = splitSources(node.en_name);
    if (parts.length <= 1) continue; // Only one part = no split needed
    
    // Phase 2: For each part (except the first), create a new node
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i === 0) {
        // Update the original node to just have the first part
        await client.query(
          "UPDATE music_source_nodes SET en_name = $1, name = $1 WHERE id = $2",
          [part, node.node_id]
        );
      } else {
        // Check if a node with this en_name already exists
        const existing = await client.query(
          "SELECT id FROM music_source_nodes WHERE game_id = $1 AND category_id = $2 AND en_name = $3",
          [node.game_id, node.category_id, part]
        );
        
        let newNodeId: number;
        if (existing.rowCount && existing.rowCount > 0) {
          newNodeId = existing.rows[0].id;
        } else {
          const insert = await client.query(
            "INSERT INTO music_source_nodes (game_id, category_id, en_name, name, parent_id) VALUES ($1,$2,$3,$3,$4) RETURNING id",
            [node.game_id, node.category_id, part, node.parent_id]
          );
          newNodeId = insert.rows[0].id;
          newNodeCount++;
        }
        
        // Create edges from the new node to all tracks that the compound node had
        for (const trackId of node.track_ids) {
          await client.query(
            "INSERT INTO track_music_sources (track_id, game_id, category_id, node_id) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING",
            [trackId, node.game_id, node.category_id, newNodeId]
          );
          newEdgeCount++;
        }
      }
    }
    deletedNodes++;
    totalParts += parts.length;
    if (deletedNodes % 5 === 0) console.log(`  Split ${deletedNodes}/${nodes.rowCount}...`);
  }

  console.log(`\nResults:`);
  console.log(`  Compound nodes: ${nodes.rowCount}`);
  console.log(`  Total individual parts: ${totalParts}`);
  console.log(`  New nodes created: ${newNodeCount}`);
  console.log(`  New edges created: ${newEdgeCount}`);

  // Final stats
  const stats = await client.query(
    `SELECT count(*) tot, count(*) FILTER(WHERE mn.en_name LIKE '% , %' OR mn.en_name LIKE '%|%' OR mn.en_name LIKE '%;;%') comp
     FROM music_source_nodes mn JOIN music_source_categories mc ON mc.id = mn.category_id WHERE mc.game_id = 3`
  );
  console.log(`  Remaining compound: ${stats.rows[0].comp}/${stats.rows[0].tot}`);

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
