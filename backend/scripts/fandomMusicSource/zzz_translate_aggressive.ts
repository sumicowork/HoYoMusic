import { Client } from "pg";
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const BASE = "https://zenless-zone-zero.fandom.com/api.php";

async function getTranslation(name: string): Promise<string | null> {
  try {
    const resp = await fetch(`${BASE}?action=parse&page=${encodeURIComponent(name)}&prop=wikitext&format=json`, {
      headers: { "User-Agent": "HoYoMusic/1.0" }, signal: AbortSignal.timeout(5000) });
    const j: any = await resp.json();
    const wt: string = j.parse?.wikitext?.["*"] || "";
    if (!wt || wt.length < 50) return null;
    if (wt.startsWith("#REDIRECT")) {
      const r = wt.match(/\[\[([^\]]+)\]\]/);
      if (r) return getTranslation(r[1].trim());
      return null;
    }
    const ol = wt.match(/\{\{Other Languages([\s\S]*?)\n\s*\}\}/i);
    if (ol) {
      const zh = ol[1].match(/\|\s*zhs\s*=\s*(.+)/i) || ol[1].match(/\|\s*zht\s*=\s*(.+)/i);
      if (zh) return zh[1].trim();
    }
    const tc = wt.match(/\{\{Transclude\|([^|}]+)\|Other Languages\}\}/i);
    if (tc) return getTranslation(tc[1].trim());
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

  // Last targeted batch: terms we haven't tried yet
  const terms = [
    "Box Galaxy", "Miasmic Field", "Provenance of Malice", "Soul Hounds III",
    "Ether Tuning Challenge", "Signal Calibration", "Recommendation Events",
    "To Be Fuel for the Night", "Flora of the Blooming Valley", "Breaded Belief",
    "Last Flight", "The Heartbeat", "Grand Marcel Maze", "Polarity Calibration",
    "On the Precipice of the Abyss", "Mach 25", "TOPS", "Season 2",
    "Cat's Lost & Found", "Tour de Inferno", "Roaming the Ether",
    "Quick Sweep", "Don't Touch", "The Defiler", "March On Tiny Titan",
    "Soul Hounds", "HAND", "Counting Bangboo", "Box Galaxy",
    "The Midnight Pursuit", "True Heroes Are Always Behind the Scenes",
    "And the True Heroes", "Every combat scenario", "Bury Your Tears",
    "A Storm of Falling Stars", "story scene", "login screen",
    "main menu", "advertisement", "mini-game", "story scenes",
    "cutscene", "QTE", "selection menu", "combat scenario",
    "invincibility mode", "delivering food", "animated cutscene",
    "Korean version", "Chinese version", "English version", "Japanese version",
    "Transfer station",
  ];

  let applied = 0;
  for (let i = 0; i < terms.length; i++) {
    const term = terms[i];
    const zh = await getTranslation(term);
    if (zh) {
      console.log(`${term} → ${zh}`);
      try {
        await client.query(
          "UPDATE music_source_nodes SET name = replace(name, $1, $2) WHERE name = en_name",
          [term, zh]
        );
        applied++;
      } catch(e: any) {
        console.error(`  ERR: ${e.message?.slice(0,30)}`);
      }
    }
    if ((i+1) % 10 === 0) process.stderr.write(".");
  }
  console.log(`\nApplied ${applied}`);

  await client.end();
}
main().catch(e => { console.error(e); process.exit(1); });
