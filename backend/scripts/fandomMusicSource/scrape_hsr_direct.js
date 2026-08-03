/**
 * DIRECT SCRAPE: For each unmatched HSR track, hit fandom wiki individual page,
 * parse Soundtrack Usage locations, create nodes + edges.
 */
const {Client}=require("C:/Users/sumi/WebstormProjects/HoYoMusic/backend/node_modules/pg");
const {getWikitext}=require("C:/Users/sumi/WebstormProjects/HoYoMusic/backend/scripts/fandomMusicSource/fandomClient");

function norm(s){return s.toLowerCase().trim();}
function decodeHtml(s){return s.replace(/&#(\d+);/g,(_,d)=>String.fromCodePoint(+d)).replace(/&mdash;/g,"—").replace(/&amp;/g,"&").replace(/&#39;/g,"'");}

// Parse HSR soundtrack usage from infobox
function parseDuring(wt){
  // Extract |during = ... from infobox
  const during=wt.match(/\|\s*during\s*=\s*(.+?)(?:\n\||\n\}\})/is);
  if(!during)return[];
  let text=during[1].trim();
  // Clean wikitext format: [url text] → text
  text=text.replace(/\[https?:[^\s\]]+\s+([^\]]+)\]/g,'$1');
  text=text.replace(/\[\[([^\|\]]+)\|([^\]]+)\]\]/g,'$2');
  text=text.replace(/\[\[([^\]]+)\]\]/g,'$1');
  text=text.replace(/''''/g,'').replace(/'''/g,'').replace(/''/g,'');
  text=decodeHtml(text);
  // Split by semicolons and commas
  const entries=text.split(/[;,]/).map(s=>s.trim()).filter(s=>s.length>2);
  
  // Classify each entry
  const locations=[];
  for(const e of entries){
    // Remove leading/trailing quotes and line noise
    const clean=e.replace(/^["'\s]+|["'\s]+$/g,'').replace(/<[^>]+>/g,'');
    if(!clean||clean.length<3)continue;
    
    // Try to determine category
    let cat='location';
    if(/boss|enemy|combat/i.test(clean))cat='boss';
    else if(/story|quest|campaign/i.test(clean))cat='story';
    else if(/event|festival|celebration/i.test(clean))cat='event';
    else if(/trailer|promo|version/i.test(clean))cat='promo';
    
    // Build simple path
    const leaf=clean.slice(0,200);
    locations.push({kind:cat,leaf});
  }
  return locations;
}

(async()=>{
const c=new Client({host:"127.0.0.1",port:15433,user:"sumicowork",password: process.env.DB_PASSWORD || "",database:"hoyomusic"});
await c.connect();

// Get unmatched tracks with title_en
const missRes=await c.query(`SELECT t.id,t.title,t.title_en,t.title_cn FROM tracks t JOIN albums a ON a.id=t.album_id WHERE a.game_id=2 AND (t.title_en IS NOT NULL AND t.title_en!='') AND NOT EXISTS (SELECT 1 FROM track_music_sources tms WHERE tms.track_id=t.id) ORDER BY t.id`);
console.log("Unmatched with title_en:",missRes.rowCount);

// Load existing categories and nodes
const catRes=await c.query("SELECT id,name FROM music_source_categories");
const catByName=new Map();
for(const r of catRes.rows)catByName.set(r.name.toLowerCase(),r.id);

const nodeRes=await c.query("SELECT id,game_id,category_id,en_name FROM music_source_nodes WHERE game_id=2");
const nodeByName=new Map();
for(const n of nodeRes.rows){
  const k=n.game_id+"|"+n.category_id+"|"+norm(n.en_name);
  nodeByName.set(k,n.id);
}
// Get next node ID
const maxIdRes=await c.query("SELECT max(id) as m FROM music_source_nodes");
let nextNodeId=(maxIdRes.rows[0].m||0)+1;

let scraped=0, createdNodes=0, createdEdges=0, noPage=0;
for(const r of missRes.rows){
  // Try English name first, then Chinese
  const names=[r.title_en,r.title_cn].filter(Boolean);
  let wt=null;
  for(const nm of names){
    try{wt=await getWikitext("honkai-star-rail",nm);if(wt.length>100)break;}catch(e){}
  }
  if(!wt||wt.length<100){noPage++;continue;}
  
  const locs=parseDuring(wt);
  if(!locs.length)continue;
  scraped++;
  
  for(const loc of locs){
    let catId=catByName.get(loc.kind);
    if(!catId)catId=catByName.get("location"); // default
    if(!catId)continue;
    
    // Find or create node
    const nodeKey="2|"+catId+"|"+norm(loc.leaf);
    let nid=nodeByName.get(nodeKey);
    if(!nid){
      // Create new node
      nid=nextNodeId++;
      await c.query("INSERT INTO music_source_nodes (id,game_id,category_id,parent_id,name,en_name,display_order) VALUES ($1,$2,$3,NULL,$4,$4,0) ON CONFLICT DO NOTHING",[nid,2,catId,loc.leaf]);
      nodeByName.set(nodeKey,nid);
      createdNodes++;
    }
    // Create edge
    await c.query("INSERT INTO track_music_sources (track_id,game_id,category_id,node_id,display_order) VALUES ($1,$2,$3,$4,0) ON CONFLICT (track_id,node_id) DO NOTHING",[r.id,2,catId,nid]);
    createdEdges++;
  }
  if(scraped%10===0)console.log("  processed",scraped,"tracks,",createdEdges,"edges...");
}

console.log("\nScraped:",scraped,"tracks | No page:",noPage);
console.log("Nodes created:",createdNodes,"| Edges:",createdEdges);
const cov=await c.query("SELECT count(DISTINCT t.id) as t,count(DISTINCT tms.track_id) as w FROM tracks t JOIN albums a ON a.id=t.album_id LEFT JOIN track_music_sources tms ON tms.track_id=t.id WHERE a.game_id=2");
console.log("Coverage:",cov.rows[0].w,"/",cov.rows[0].t,"=",Math.round(cov.rows[0].w/cov.rows[0].t*100)+"%");
await c.end();
})();
