import { Client } from "pg";
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const BL_API = "https://wiki.biligame.com/zzz/api.php";

async function getBilibiliTitle(trackName: string): Promise<string | null> {
  try {
    // Search for the page
    const resp = await fetch(`${BL_API}?action=query&list=search&srsearch=${encodeURIComponent(trackName)}&format=json&srlimit=3`, {
      headers: { "User-Agent": "HoYoMusic/1.0" } });
    const j: any = await resp.json();
    const hits = j.query?.search || [];
    
    for (const hit of hits) {
      // Get page content
      const r2 = await fetch(`${BL_API}?action=parse&page=${encodeURIComponent(hit.title)}&prop=wikitext&format=json`, {
        headers: { "User-Agent": "HoYoMusic/1.0" } });
      const j2: any = await r2.json();
      const wt: string = j2.parse?.wikitext?.["*"] || "";
      
      // Extract B站视频标题
      const titleMatch = wt.match(/\|B站视频标题\s*=\s*(.+)/);
      if (titleMatch) {
        const title = titleMatch[1].trim();
        // Clean: remove <br> tags, brackets
        return title.replace(/<br\s*\/?>|<[^>]+>/g, "").trim();
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

  // Get the EP names from PV/宣传 nodes
  const res = await client.query(
    `SELECT DISTINCT mn.name FROM music_source_nodes mn
     JOIN music_source_categories mc ON mc.id = mn.category_id
     WHERE mc.game_id = 3 AND mc.name = 'PV/宣传'`
  );

  // Extract EP identifiers from node names
  const epSet = new Set<string>();
  for (const r of res.rows) {
    // Pattern: "X EP -" or "X EP –" or "Character Demo –"
    const epMatch = r.name.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+EP\s*[–-]/);
    if (epMatch) epSet.add(epMatch[1] + " EP");
    const cdMatch = r.name.match(/(\w[\w\s]{2,40})\s+Character\s+Demo/);
    if (cdMatch) epSet.add(cdMatch[1] + " Character Demo");
    const mvMatch = r.name.match(/(\w[\w\s]{2,40})\s+MV\s*[–-]/);
    if (mvMatch) epSet.add(mvMatch[1] + " MV");
    const teaserMatch = r.name.match(/(\w[\w\s]{2,40})\s+Teaser\s*[–-]/);
    if (teaserMatch) epSet.add(teaserMatch[1] + " Teaser");
    const themeMatch = r.name.match(/(\w[\w\s]{2,40})\s+Theme\s+Song/);
    if (themeMatch) epSet.add(themeMatch[1] + " Theme Song");
    const shortMatch = r.name.match(/(\w[\w\s]{2,40})\s+Animated\s+Short/);
    if (shortMatch) epSet.add(shortMatch[1] + " Animated Short");
  }

  const eps = [...epSet];
  console.log(`Found ${eps.length} EP identifiers:`, eps.join(", "));

  // Look up bilibili titles
  const titleMap = new Map<string, string>();
  for (const ep of eps) {
    console.log(`Looking up: ${ep}`);
    const title = await getBilibiliTitle(ep);
    if (title) {
      console.log(`  → ${title}`);
      titleMap.set(ep, title);
    } else {
      console.log(`  → NOT FOUND`);
    }
  }

  // Apply replacements
  let applied = 0;
  for (const [ep, cnTitle] of titleMap) {
    // Extract EP name without "EP" suffix
    const epName = ep.replace(/\s*(EP|Character Demo|MV|Teaser|Theme Song|Animated Short)$/, "");
    const patterns = [
      ep,  // Full match: "Burnice EP"
      epName, // Just the name part
    ];
    
    for (const pat of patterns) {
      if (pat.length < 3) continue;
      try {
        const result = await client.query(
          "UPDATE music_source_nodes SET name = replace(name, $1, $2) WHERE name ~ $3",
          [pat, cnTitle, pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')]
        );
        applied++;
      } catch(e: any) {
        console.error(`  ERR: ${e.message?.slice(0,50)}`);
      }
    }
  }
  
  console.log(`\nApplied ${applied} replacements`);

  // Stats
  console.log("\nSample of updated PV nodes:");
  const sample = await client.query(
    `SELECT mn.name FROM music_source_nodes mn
     JOIN music_source_categories mc ON mc.id = mn.category_id
     WHERE mc.game_id = 3 AND mc.name = 'PV/宣传' LIMIT 5`
  );
  sample.rows.forEach(r => console.log(`  ${r.name.slice(0,120)}`));

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
