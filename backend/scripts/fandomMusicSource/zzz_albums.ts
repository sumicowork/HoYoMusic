import { Client } from "pg";
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const BASE = "https://zenless-zone-zero.fandom.com/api.php";

interface PlayedInEntry {
  trackNum: number;
  trackName: string;
  source: string;
}

interface FeaturedEntry {
  albumName: string;
  trackNum: number;
  source: string;
}

async function fetchTrackFeatured(pageTitle: string): Promise<FeaturedEntry | null> {
  const params = new URLSearchParams({ action: "parse", page: pageTitle, prop: "wikitext", format: "json" });
  try {
    const resp = await fetch(`${BASE}?${params}`, {
      headers: { "User-Agent": "HoYoMusic/1.0" }, signal: AbortSignal.timeout(10000) });
    const j: any = await resp.json();
    const wt: string = j.parse?.wikitext?.["*"] || "";
    if (!wt) return null;
    const ibox = wt.match(/\{\{Soundtrack\s+Infobox([\s\S]{0,600}?)\}\}/i);
    if (!ibox) return null;
    const albumMatch = ibox[1].match(/\|\s*album\s*=\s*(.+)/i);
    const numMatch = ibox[1].match(/\|\s*number\s*=\s*(.+)/i);
    const featuredMatch = ibox[1].match(/\|\s*featured\d?\s*=\s*(.+)/gi);
    if (!albumMatch || !numMatch || !featuredMatch) return null;
    let albumName = albumMatch[1].trim();
    albumName = albumName.replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, "$1").replace(/[[\]]/g, "").trim();
    const trackNum = parseInt(numMatch[1].trim());
    if (isNaN(trackNum) || trackNum <= 0) return null;
    const sources: string[] = [];
    for (const fm of featuredMatch) {
      const raw = fm.replace(/^\|\s*featured\d?\s*=\s*/, "").trim();
      const parts = raw.split(";;");
      for (const p of parts) {
        const trimmed = p.trim();
        if (trimmed.startsWith("[http") || trimmed.startsWith("http")) continue;
        if (!trimmed || trimmed.length < 2) continue;
        let c = trimmed.replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, "$1").replace(/[[\]]/g, "").trim();
        // Strip YouTube clutter: "Title | Zenless Zone Zero" → "Title"
        c = c.replace(/\s*\|\s*Zenless Zone Zero.*$/, "").trim();
        // Strip trailing " - Zenless Zone Zero"
        c = c.replace(/\s*[-–—]\s*Zenless Zone Zero\s*$/, "").trim();
        // Clean wiki italic markers: ''text'' → 'text'
        c = c.replace(/\'\'([^\']+)\'\'/g, "'$1'");
        // Normalize spaces
        c = c.replace(/\s{2,}/g, " ").trim();
        // Reject truncated fragments
        if (c.endsWith("...") || c.length < 5) continue;
        if (c) sources.push(c);
      }
    }
    if (sources.length === 0) return null;
    return { albumName, trackNum, source: sources.join(";;") };
  } catch(e) { return null; }
}

async function fetchAlbumPlayedIn(albumTitle: string): Promise<PlayedInEntry[]> {
  const params = new URLSearchParams({ action: "parse", page: albumTitle, prop: "text", format: "json" });
  try {
    const resp = await fetch(`${BASE}?${params}`, {
      headers: { "User-Agent": "HoYoMusic/1.0" }, signal: AbortSignal.timeout(10000) });
    const json: any = await resp.json();
    const html: string = json.parse?.text?.["*"] || "";
    if (!html) return [];
    const piIdx = html.indexOf("Played In");
    if (piIdx < 0) return [];
    const tbodyStart = html.lastIndexOf("<tbody>", piIdx);
    if (tbodyStart < 0) return [];
    const tbodyEnd = html.indexOf("</tbody>", piIdx);
    if (tbodyEnd < 0) return [];
    const tbody = html.slice(tbodyStart, tbodyEnd);
    const entries: PlayedInEntry[] = [];
    const trs = tbody.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [];
    let trackNum = 0;
    for (const row of trs) {
      if (row.includes("<th")) continue;
      trackNum++;
      const tdMatch = row.match(/<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/);
      if (!tdMatch) continue;
      const trackTd = tdMatch[2];
      const sourceTd = tdMatch[3];
      let trackName = "";
      const titleM = trackTd.match(/title="([^"]+)"/);
      if (titleM) trackName = titleM[1].trim();
      else trackName = trackTd.replace(/<[^>]+>/g, "").trim();
      let source = sourceTd.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      source = source.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#124;/g, "|");
      // Strip YouTube clutter from PlayedIn text
      source = source.replace(/\s*\|\s*Zenless Zone Zero.*$/, "").trim();
      // Clean wiki italic markers and normalize
      source = source.replace(/\'\'([^\']+)\'\'/g, "'$1'").replace(/\s{2,}/g, " ").trim();
      // Reject truncated
      if (source.endsWith("...") || source.length < 5) continue;
      if (trackName && source && source.length < 500) {
        entries.push({ trackNum, trackName, source });
      }
    }
    return entries;
  } catch (e) { return []; }
}

/** Batch-fetch Chinese translations for wiki page names */
async function batchTranslate(names: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const unique = [...new Set(names)].filter(n => n.length > 1 && !n.startsWith("http"));
  for (let i = 0; i < unique.length; i++) {
    const name = unique[i];
    try {
      const resp = await fetch(`${BASE}?action=parse&page=${encodeURIComponent(name)}&prop=wikitext&format=json`, {
        headers: { "User-Agent": "HoYoMusic/1.0" }, signal: AbortSignal.timeout(5000) });
      const j: any = await resp.json();
      const wt: string = j.parse?.wikitext?.["*"] || "";
      // Try Other Languages template
      const olMatch = wt.match(/\{\{Other Languages([\s\S]*?)\n\s*\}\}/i);
      if (olMatch) {
        const zhMatch = olMatch[1].match(/\|\s*zhs\s*=\s*(.+)/i) || olMatch[1].match(/\|\s*zht\s*=\s*(.+)/i);
        if (zhMatch) {
          result.set(name, zhMatch[1].trim());
          continue;
        }
      }
      // Try Transclude
      const tcMatch = wt.match(/\{\{Transclude\|([^|}]+)\|Other Languages\}\}/i);
      if (tcMatch) {
        const transPage = tcMatch[1].trim();
        const r2 = await fetch(`${BASE}?action=parse&page=${encodeURIComponent(transPage)}&prop=wikitext&format=json`, {
          headers: { "User-Agent": "HoYoMusic/1.0" }, signal: AbortSignal.timeout(5000) });
        const j2: any = await r2.json();
        const wt2: string = j2.parse?.wikitext?.["*"] || "";
        const ol2Match = wt2.match(/\{\{Other Languages([\s\S]*?)\n\s*\}\}/i);
        if (ol2Match) {
          const zh2Match = ol2Match[1].match(/\|\s*zhs\s*=\s*(.+)/i) || ol2Match[1].match(/\|\s*zht\s*=\s*(.+)/i);
          if (zh2Match) { result.set(name, zh2Match[1].trim()); continue; }
        }
      }
    } catch(e) {}
    // Rate limit
    if (i % 5 === 0) await new Promise(r => setTimeout(r, 500));
  }
  return result;
}

/** Clean source text and replace English wiki links with Chinese translations */
function cleanSource(raw: string, translations: Map<string, string>): string {
  // Extract [[PageName]] or [[PageName|Display]] and replace with Chinese if available
  let cleaned = raw.replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, (match, pageName) => {
    const zh = translations.get(pageName.trim());
    if (zh) return zh;
    if (pageName.includes("/")) {
      const shortName = pageName.split("/").pop()?.trim() || pageName;
      const zh2 = translations.get(shortName);
      if (zh2) return zh2;
    }
    return pageName.trim();
  });
  // Limit to 190 chars for DB
  if (cleaned.length > 190) cleaned = cleaned.slice(0, 187) + "...";
  return cleaned;
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

  const gameRes = await client.query("SELECT id FROM games WHERE name='绝区零'");
  if (gameRes.rowCount === 0) { console.log("ZZZ game not found"); return; }
  const gameId = gameRes.rows[0].id;

  const albumsRes = await client.query(
    `SELECT a.id, a.title FROM albums a WHERE a.game_id = $1`, [gameId] );
  const albumByTitle = new Map<string, number>();
  for (const a of albumsRes.rows) {
    const rawTitle = a.title?.replace(/^绝区零[-–—]\s*/, "").toLowerCase().trim() || "";
    if (rawTitle) albumByTitle.set(rawTitle, a.id);
    const engPart = rawTitle.match(/^([A-Za-z0-9!?^&*()_+\-=\[\]{};':"\\|,.<>\/~`@#$% ]+)/);
    if (engPart) {
      const eng = engPart[1].toLowerCase().trim().replace(/\s+/g, ' ');
      if (eng.length > 2) albumByTitle.set(eng, a.id);
    }
  }

  const tracksRes = await client.query(
    `SELECT t.id, t.track_number, t.album_id, t.disc_id FROM tracks t JOIN albums a ON a.id=t.album_id WHERE a.game_id=$1`, [gameId] );
  const trackByKey = new Map<string, number>();
  const trackByAlbumNum = new Map<string, number>();
  for (const t of tracksRes.rows) {
    if (t.track_number) {
      trackByKey.set(`${t.album_id}|${t.disc_id||0}|${t.track_number}`, t.id);
      trackByAlbumNum.set(`${t.album_id}|${t.track_number}`, t.id);
    }
  }

  // Collect all fandom pages, tracking which fandom category they came from
  const fandomCategories = ["Singles", "Albums", "Soundtracks", "Extended Plays"];
  const albumPageToCat = new Map<string, string>();
  const albumPagesSet = new Set<string>();
  for (const cat of fandomCategories) {
    try {
      const resp = await fetch(
        `${BASE}?action=query&list=categorymembers&cmtitle=Category:${encodeURIComponent(cat)}&format=json&cmlimit=100`,
        { headers: { "User-Agent": "HoYoMusic/1.0" } });
      const json: any = await resp.json();
      if (json.query?.categorymembers) {
        for (const c of json.query.categorymembers) {
          if (!c.title.includes("Soundtracks") && !c.title.includes("/")) {
            albumPagesSet.add(c.title);
            if (!albumPageToCat.has(c.title)) albumPageToCat.set(c.title, cat);
          }
        }
      }
    } catch(e) {}
  }
  const albumPages = [...albumPagesSet];
  console.log(`Total unique album pages: ${albumPages.length}`);

  // Get/create two categories
  async function ensureCategory(name: string): Promise<number> {
    const res = await client.query("SELECT id FROM music_source_categories WHERE name=$1 AND game_id=$2", [name, gameId]);
    if (res.rowCount && res.rowCount > 0) return res.rows[0].id;
    const ins = await client.query("INSERT INTO music_source_categories (game_id, name) VALUES ($1,$2) RETURNING id", [gameId, name]);
    return ins.rows[0]?.id || 0;
  }
  const catPV = await ensureCategory("PV/宣传");
  const catScene = await ensureCategory("场景音乐");
  const catEvent = await ensureCategory("活动玩法");

  // Node caches per category
  const nodeCache = new Map<number, Map<string, number>>();
  for (const catId of [catPV, catScene, catEvent]) {
    const res = await client.query("SELECT id, en_name FROM music_source_nodes WHERE game_id=$1 AND category_id=$2", [gameId, catId]);
    const m = new Map<string, number>();
    for (const n of res.rows) { if (n.en_name) m.set(n.en_name.toLowerCase(), n.id); }
    nodeCache.set(catId, m);
  }

  // Batch translate: collect all wiki links from all PlayedIn tables first
  const allSources: string[] = [];
  for (let i = 0; i < albumPages.length; i++) {
    const pageTitle = albumPages[i];
    if (albumPageToCat.get(pageTitle) === "Singles" || albumPageToCat.get(pageTitle) === "Albums") {
      const entries = await fetchAlbumPlayedIn(pageTitle);
      for (const e of entries) allSources.push(e.source);
    }
    if (i % 10 === 0) process.stderr.write(".");
  }
  console.log(`\nCollected ${allSources.length} source strings for translation`);

  // Extract wiki links from sources
  const wikiLinks = new Set<string>();
  for (const src of allSources) {
    const matches = src.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g);
    if (matches) {
      for (const m of matches) {
        const pn = m.replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/, "$1").trim();
        if (pn.length > 1 && !pn.includes("http")) wikiLinks.add(pn);
      }
    }
  }
  console.log(`Found ${wikiLinks.size} unique wiki links, fetching translations...`);
  
  const translations = await batchTranslate([...wikiLinks]);
  console.log(`Got ${translations.size} translations`);

  // Direct fandom album → DB album mapping
  const fandomAlbumIdMap = new Map<string, number>();
  fandomAlbumIdMap.set("hyper commission (album)", 72);
  fandomAlbumIdMap.set("hyper commission 2.0 (album)", 71);
  fandomAlbumIdMap.set("stars of lyra+", 77);
  fandomAlbumIdMap.set("loading... (album)", 86);
  fandomAlbumIdMap.set("hyper commission: teaser soundtrack", 69);
  fandomAlbumIdMap.set("hyper commission 2.0: character teaser soundtrack collection (album)", 70);

  const manualMap: Record<string, string> = {
    "a thousand first meetings": "千次初见", "almost": "不及",
    "angel loading...^_−☆": "天使加载中…^_−☆", "as the sugar cube floats, fleeting in time": "一颗方糖悬滞的时间",
    "billy mode": "billy mode 小巨星", "chaos.exe": "chaos.exe",
    "crimson pierces the twilight": "红透晚烟青", "daybreak": "晓",
    "fantastical-colored heartbeat": "妄想色心跳", "hyper commission": "极限委托",
    "hyper commission 2.0": "极限委托2.0", "i ask": "问",
    "picture book": "绘本", "prophecy": "prophecy", "rest awhile": "小停再出发",
    "self-cultivation through food": "食通万物 修心修身",
    "shining promise in the sky of dawn": "拂晓之空 闪耀之誓",
    "stars of lyra+": "天琴座+", "turn heartbeats into tempo": "把心跳变成节奏",
    "wonderland trickery": "乐园梦游计", "zenless": "zenless",
    "zenless zone zero 2024 mix ｜ hyper commission": "极限委托：PV原声集",
    "hyper commission: teaser soundtrack": "极限委托：PV原声集",
    "hyper commission 2.0: character teaser soundtrack collection (album)": "极限委托2.0：PV原声集",
    "loading...": "loading…",
  };

  // Track nodes to create per category
  interface PendingNode { catId: number; sourceName: string; }
  const pendingNodes: Array<{trackId: number; gameId: number; catId: number; nodeName: string}> = [];

  let totalEntries = 0, matchedTracks = 0;

  for (let i = 0; i < albumPages.length; i++) {
    const pageTitle = albumPages[i];
    const fandomCat = albumPageToCat.get(pageTitle) || "Soundtracks";
    let entries: PlayedInEntry[] = [];
    let dbAlbumId: number | undefined;
    let targetCatId = fandomCat === "Singles" ? catPV : catScene;
    
    const fandomAlbumName = pageTitle.replace(/ \(Album\)$/i, "").toLowerCase().trim();
    dbAlbumId = albumByTitle.get(fandomAlbumName);
    if (!dbAlbumId) dbAlbumId = fandomAlbumIdMap.get(fandomAlbumName);
    if (!dbAlbumId) dbAlbumId = fandomAlbumIdMap.get(fandomAlbumName + " (album)");
    if (!dbAlbumId) {
      for (const [key, id] of albumByTitle) {
        if (fandomAlbumName.includes(key) || key.includes(fandomAlbumName)) { dbAlbumId = id; break; }
      }
    }
    if (!dbAlbumId) {
      const mapped = manualMap[fandomAlbumName];
      if (mapped) {
        dbAlbumId = albumByTitle.get(mapped);
        if (!dbAlbumId) for (const [key, id] of albumByTitle) { if (key.includes(mapped)) { dbAlbumId = id; break; } }
      }
    }
    if (!dbAlbumId) {
      const featured = await fetchTrackFeatured(pageTitle);
      if (featured) {
        let albumId2 = fandomAlbumIdMap.get(featured.albumName.toLowerCase().trim());
        if (!albumId2) albumId2 = albumByTitle.get(featured.albumName.toLowerCase().trim());
        if (!albumId2) {
          const stripped = featured.albumName.replace(/ \(album\)$/i, "").toLowerCase().trim();
          albumId2 = fandomAlbumIdMap.get(stripped) || albumByTitle.get(stripped);
        }
        if (!albumId2) {
          for (const [key, id] of albumByTitle) {
            if (key.includes(featured.albumName.toLowerCase()) || featured.albumName.toLowerCase().includes(key)) {
              albumId2 = id; break;
            }
          }
        }
        if (albumId2 && featured.trackNum > 0) {
          if (featured.source) {
            entries = [{ trackNum: featured.trackNum, trackName: pageTitle, source: featured.source }];
            // Individual Soundtrack pages from Events → "活动玩法"
            if (featured.source.includes("A Harmony of Delusions") || featured.source.includes("Rhythm Rave")) {
              targetCatId = catEvent;
            }
          }
          dbAlbumId = albumId2;
        }
      }
      if (!dbAlbumId) { console.log(`[${i+1}/${albumPages.length}] ${pageTitle} → ⚠️ album not matched`); continue; }
    }

    console.log(`[${i+1}/${albumPages.length}] ${pageTitle} → DB ${dbAlbumId} (${fandomCat})`);

    if (entries.length === 0) {
      for (let attempt = 0; attempt < 2; attempt++) {
        entries = await fetchAlbumPlayedIn(pageTitle);
        if (entries.length > 0) break;
        if (attempt < 1) await new Promise(r => setTimeout(r, 2000));
      }
    }
    totalEntries += entries.length;

    for (const entry of entries) {
      if (entry.trackNum <= 0) continue;
      let trackId = trackByKey.get(`${dbAlbumId}|0|${entry.trackNum}`);
      if (!trackId) trackId = trackByAlbumNum.get(`${dbAlbumId}|${entry.trackNum}`);
      if (!trackId) { console.log(`  #${entry.trackNum} ⚠️ no match: "${entry.trackName}"`); continue; }
      matchedTracks++;

      const cleanName = cleanSource(entry.source, translations);
      pendingNodes.push({ trackId, gameId, catId: targetCatId, nodeName: cleanName });
    }

    if ((i+1) % 5 === 0) await new Promise(r => setTimeout(r, 1000));
  }

  // Batch-insert nodes and edges
  let newNodes = 0, edgesCreated = 0;
  for (const pn of pendingNodes) {
    const cache = nodeCache.get(pn.catId)!;
    const key = pn.nodeName.toLowerCase();
    let nodeId: number | undefined = cache.get(key);
    if (!nodeId) {
      const ins = await client.query(
        "INSERT INTO music_source_nodes (game_id, category_id, en_name, name) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING id",
        [pn.gameId, pn.catId, pn.nodeName, pn.nodeName] );
      if (ins.rows.length > 0) { nodeId = ins.rows[0].id; newNodes++; }
      else {
        const exist = await client.query("SELECT id FROM music_source_nodes WHERE game_id=$1 AND category_id=$2 AND en_name=$3", [pn.gameId, pn.catId, pn.nodeName]);
        nodeId = exist.rows[0]?.id;
      }
      if (nodeId) cache.set(key, nodeId);
    }
    if (!nodeId) continue;
    await client.query(
      "INSERT INTO track_music_sources (track_id, game_id, category_id, node_id) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING",
      [pn.trackId, pn.gameId, pn.catId, nodeId] );
    edgesCreated++;
  }

  console.log(`\n=== Results ===`);
  console.log(`Total entries: ${totalEntries}`);
  console.log(`Matched: ${matchedTracks}`);
  console.log(`New nodes: ${newNodes}`);
  console.log(`Edges: ${edgesCreated}`);
  console.log(`Translations used: ${translations.size}`);

  const verify = await client.query(
    `SELECT count(DISTINCT t.id) total, count(DISTINCT tms.track_id) w_src FROM tracks t JOIN albums a ON a.id=t.album_id LEFT JOIN track_music_sources tms ON tms.track_id=t.id WHERE a.game_id=$1`, [gameId] );
  console.log(`\nZZZ Coverage: ${verify.rows[0].w_src}/${verify.rows[0].total} (${Math.round(verify.rows[0].w_src/verify.rows[0].total*100)}%)`);

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
