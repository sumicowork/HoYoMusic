import { Client } from "pg";
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const BASE = "https://zenless-zone-zero.fandom.com/api.php";

async function getPageTranslation(pageName: string): Promise<string | null> {
  try {
    const resp = await fetch(`${BASE}?action=parse&page=${encodeURIComponent(pageName)}&prop=wikitext&format=json`, {
      headers: { "User-Agent": "HoYoMusic/1.0" }, signal: AbortSignal.timeout(5000) });
    const j: any = await resp.json();
    const wt: string = j.parse?.wikitext?.["*"] || "";
    if (wt.startsWith("#REDIRECT")) {
      const redirect = wt.match(/\[\[([^\]]+)\]\]/);
      if (redirect) return getPageTranslation(redirect[1].trim());
    }
    const ol = wt.match(/\{\{Other Languages([\s\S]*?)\n\s*\}\}/i);
    if (ol) {
      const zh = ol[1].match(/\|\s*zhs\s*=\s*(.+)/i) || ol[1].match(/\|\s*zht\s*=\s*(.+)/i);
      if (zh) return zh[1].trim();
    }
    const tc = wt.match(/\{\{Transclude\|([^|}]+)\|Other Languages\}\}/i);
    if (tc) {
      const r2 = await fetch(`${BASE}?action=parse&page=${encodeURIComponent(tc[1].trim())}&prop=wikitext&format=json`, {
        headers: { "User-Agent": "HoYoMusic/1.0" }, signal: AbortSignal.timeout(5000) });
      const j2: any = await r2.json();
      const wt2 = j2.parse?.wikitext?.["*"] || "";
      const ol2 = wt2.match(/\{\{Other Languages([\s\S]*?)\n\s*\}\}/i);
      if (ol2) {
        const zh2 = ol2[1].match(/\|\s*zhs\s*=\s*(.+)/i) || ol2[1].match(/\|\s*zht\s*=\s*(.+)/i);
        if (zh2) return zh2[1].trim();
      }
    }
  } catch(e) {}
  return null;
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

  // Get game tracks that have source data, plus their source node names
  const res = await client.query(
    `SELECT DISTINCT mn.id as node_id, mn.en_name, mn.name, t.id as track_id, t.title_en
     FROM music_source_nodes mn
     JOIN track_music_sources tms ON tms.node_id = mn.id
     JOIN tracks t ON t.id = tms.track_id
     JOIN music_source_categories mc ON mc.id = mn.category_id
     WHERE mc.game_id = 3`
  );
  console.log(`Nodes with tracks: ${res.rowCount}`);

  // For each track, fetch its fandom Soundtrack page and extract wiki links from the featured field
  const wikiLinks = new Set<string>();
  const { getWikitext } = require("./fandomClient");
  
  console.log("Collecting wiki links from Soundtrack pages...");
  let processed = 0;
  const trackPages = new Set<string>();
  for (const r of res.rows) {
    // Use title_en if available, otherwise skip
    const pageName = r.title_en;
    if (!pageName || pageName.length < 2) continue;
    if (trackPages.has(pageName)) { processed++; continue; }
    trackPages.add(pageName);
    
    try {
      const wt = await getWikitext("zenless-zone-zero", pageName);
      if (!wt) continue;
      // Extract featured field with [[links]]
      const featured = wt.match(/\|\s*featured\d?\s*=\s*(.+)/gi);
      if (featured) {
        for (const f of featured) {
          const links = f.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g);
          if (links) {
            for (const l of links) {
              const pn = l.replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/, "$1").trim();
              if (pn.length > 1 && !pn.includes("http") && !pn.startsWith("File:") && !pn.startsWith("#")) {
                wikiLinks.add(pn);
              }
            }
          }
        }
      }
    } catch(e) {}
    processed++;
    if (processed % 10 === 0) process.stderr.write(".");
  }
  console.log(`\nUnique wiki links: ${wikiLinks.size}`);

  // Translate all wiki links
  console.log("Translating...");
  const translations = new Map<string, string>();
  const links = [...wikiLinks];
  for (let i = 0; i < links.length; i++) {
    const zh = await getPageTranslation(links[i]);
    if (zh) {
      translations.set(links[i], zh);
      console.log(`  ${links[i]} → ${zh}`);
    }
    if ((i + 1) % 5 === 0) {
      process.stderr.write(".");
      await new Promise(r => setTimeout(r, 300));
    }
  }
  console.log(`\nGot ${translations.size} translations`);

  // Apply translations to node names
  let updated = 0;
  for (const r of res.rows) {
    let newName = r.en_name;
    let changed = false;
    for (const [en, zh] of translations) {
      const escaped = en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'g');
      if (regex.test(newName)) {
        newName = newName.replace(regex, zh);
        changed = true;
      }
    }
    if (changed && newName !== r.en_name && newName.length <= 200) {
      await client.query("UPDATE music_source_nodes SET name = $1 WHERE id = $2", [newName, r.id]);
      updated++;
    }
  }
  console.log(`Updated ${updated} node names`);

  // Stats
  const stats = await client.query(
    `SELECT count(*) as total, count(*) FILTER(WHERE name != en_name) as translated
     FROM music_source_nodes mn
     JOIN music_source_categories mc ON mc.id = mn.category_id
     WHERE mc.game_id = 3`
  );
  console.log(`\nTranslation status: ${stats.rows[0].translated}/${stats.rows[0].total} nodes have Chinese names`);

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
