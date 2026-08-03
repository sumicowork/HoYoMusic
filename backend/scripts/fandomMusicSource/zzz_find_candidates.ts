import { Client } from "pg";
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// Extract all distinct English phrases (3+ words) from untranslated nodes
// These are candidates for wiki translation lookup

function extractPhrases(text: string): string[] {
  const phrases: Set<string> = new Set();
  // Extract quoted song/movie titles
  const quoted = text.match(/"([^"]{3,})"/g);
  if (quoted) quoted.forEach(q => phrases.add(q.replace(/^"|"$/g, "")));
  
  // Extract patterns like "Character Demo - X" → "X"
  const afterDash = text.match(/- "([^"]+)"/);
  if (afterDash) phrases.add(afterDash[1]);
  
  // Extract patterns like "XXX movie in YYY"
  const movieIn = text.match(/"([^"]+)" movie in/);
  if (movieIn) phrases.add(movieIn[1]);
  
  // Extract patterns like "Battle against XXX"
  const battle = text.match(/Battle (?:against|with) (.+?)(?: -|$|inside|during)/);
  if (battle) {
    const enemy = battle[1].trim();
    if (enemy.length > 3 && !enemy.match(/^Code Name/)) phrases.add(enemy);
  }
  
  // Extract fight against patterns
  const fight = text.match(/(?:fight|Fight) against (.+?)(?: during|$)/);
  if (fight) {
    const enemy = fight[1].trim();
    if (enemy.length > 3) phrases.add(enemy);
  }
  
  // Extract "Notorious Hunt: XXX"
  const hunt = text.match(/Notorious Hunt: (.+)/);
  if (hunt) {
    const name = hunt[1].trim();
    if (name.length > 3) phrases.add(name);
  }
  
  // Extract "Agent Story XXX" / "Agent Record XXX"
  const agent = text.match(/Agent (?:Story|Record)s?:? (.+)/);
  if (agent) {
    const name = agent[1].trim();
    if (name.length > 4 && !name.includes("(")) phrases.add(name);
  }
  
  // Extract proper noun phrases: Two+ capitalized words
  const proper = text.match(/[A-Z][a-z]+(?: [A-Z][a-z]+)+/g);
  if (proper) {
    for (const p of proper) {
      if (p.length > 6 && !p.match(/Version|Teaser|Chapter|Season|Preview|Trailer|Login Screen|Main Menu|Menu Theme|Weekday|Weekend|Morning|Afternoon|Evening|Midnight|Every|Battle|Fight|inside|during|while/)) {
        phrases.add(p);
      }
    }
  }
  
  return Array.from(phrases);
}

async function main() {
  const c = new Client({
    host: process.env.DB_HOST || "127.0.0.1",
    port: parseInt(process.env.DB_PORT || "15433"),
    user: process.env.DB_USER || "sumicowork",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "hoyomusic",
  });
  await c.connect();

  // Get ALL untranslated nodes
  const res = await c.query(`
    SELECT mn.en_name FROM music_source_nodes mn 
    JOIN music_source_categories mc ON mc.id=mn.category_id 
    WHERE mc.game_id=3 AND mn.name=mn.en_name
    ORDER BY mn.id
  `);

  // Also get mixed nodes to extract their English fragments
  const mixed = await c.query(`
    SELECT mn.en_name, mn.name FROM music_source_nodes mn 
    JOIN music_source_categories mc ON mc.id=mn.category_id 
    WHERE mc.game_id=3 AND mn.name != mn.en_name
    ORDER BY mn.id
  `);

  const allPhrases = new Set<string>();
  
  for (const r of res.rows) {
    const phrases = extractPhrases(r.en_name);
    phrases.forEach(p => allPhrases.add(p));
  }
  
  // Also extract from en_name of mixed nodes (original English)
  for (const r of mixed.rows) {
    const phrases = extractPhrases(r.en_name);
    phrases.forEach(p => allPhrases.add(p));
  }

  // Filter: remove phrases we already have in the dict
  const existing = new Set([
    "Zenless Zone Zero", "Rhythm Rave", "Agent Story", "Sixth Street", "Random Play",
    "Lumina Square", "Port Elpis", "Scott Outpost", "Hollow Zero", "Blazewood",
    "Failume Heights", "Ridu", "Hollow", "Commission", "Commissions",
    "Daybreak", "Rest Awhile", "Wonderland Trickery", "Picture Book",
    "Self-Cultivation Through Food", "Turn Heartbeats Into Tempo",
    "Shining Promise in the Sky of Dawn", "Gravitational Attraction", "The Port Peak",
    "Band of Brave Bangboo", "Deadly Interrogation", "Inferno Reap", "Virtual Revenge",
    "Lost Void", "Withered Domain", "Overheated Barrel", "Camellia Golden Week",
    "Sailume Bay", "Pulchra", "Bellum", "Mors", "Miasma Priest", "Twin Marionettes",
    "Cheesetopia", "Provenance of Malice", "The Prophecy", "Soul Hounds III",
    "Roaming the Ether", "The Defector", "Dullahan", "Signal Search", "Devon Pawnshop",
    "Circuit Reset", "Starloop", "Public Security Office", "Buyan Antique Store",
    "Dew Gardening Shop", "Astra-nomical Moment", "Fallen Mecha Stronghold",
    "HIA Club", "Suibian Temple", "Ballet Twins Road", "Fantasy Resort",
    "Gray Veil Marionette", "Fishing", "Flora of the Blooming Valley",
    "When Dreams Remain Unfinished", "Zero Point Calibration", "Gravity Cinema",
    "Tour de Inferno", "Neo Golden Mecha", "Razor", "Threshold Simulation",
    "Into That Pale Wasteland", "Hurcules", "Mecha Golden Bangboo",
    "Bangboo vs Ethereal", "Symbiotic Ethereal Swarm", "Parasitic Ethereal Swarm",
    "Nineveh", "Geppetto", "Brant Street Construction Site",
    "Encore for an Old Dream", "Dew Gardening", "Endless Tower",
    "The Impending Crash of Waves", "Do Not Go Gentle Into That Good Night",
    "Memories of Dreams Bygone", "Echoes of Silver", "Destined to Meet Again",
    "Where Clouds Embrace the Dawn", "A Surprise", "A Name Written in Water",
    "It's Me... Leave A Message", "The Midnight Pursuit", "Cat's Lost & Found",
    "A Dream Come True", "A Storm of Falling Stars", "Bury Your Tears With the Past",
    "Bizarre Brigade", "Mach 25", "On the Precipice of the Abyss",
    "Signal Calibration", "To Be Fuel for the Night", "Every combat",
    "combat", "Combat", "afternoon", "Angels of Delusion", "Season 2",
    "Bangboo vs Ethereal",
    // Characters
    "Ellen", "Ellen Joe", "Caesar", "Caesar King", "Lighter", "Lucia",
    "Evelyn", "Evelyn Chevalier", "Burnice", "Burnice White", "Aria", "Sunna",
    "Zhao", "Yi Xuan", "Asaba Harumasa", "Hoshimi Miyabi", "Ju Fufu",
    "Nangong Yu", "Tsukishiro Yanagi", "Ukinami Yuzuha", "Zhu Yuan",
    "Astra Yao", "Qingyi", "Ye Shiyuan", "Komano Manato", "Hugo Vlad",
    "Hugo", "Sarah Floren", "Pan Yinhu", "Banyue",
    "Yum Cha Sin", "Bringer", "Mevorakh", "Creator", "The Defiler",
  ]);

  const candidates = Array.from(allPhrases)
    .filter(p => p.length > 3 && !existing.has(p))
    .filter(p => !p.match(/^\d|^\(|^\[/)) // skip things starting with numbers or brackets
    .sort();

  console.log(`Found ${candidates.length} unique candidate phrases to check:\n`);
  candidates.forEach((p, i) => console.log(`${i+1}. ${p}`));

  await c.end();
}

main().catch(e => { console.error(e); process.exit(1); });
