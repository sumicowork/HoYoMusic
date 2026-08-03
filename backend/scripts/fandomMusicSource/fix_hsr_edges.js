/**
 * Fix HSR edges: decode HTML entities + pageTitle fallback
 * Inserts missed track_music_sources edges that should have matched
 */
const {Client}=require("C:/Users/sumi/WebstormProjects/HoYoMusic/backend/node_modules/pg");
const fs=require("fs");

function normAgg(s){return (s||"").toLowerCase().replace(/[“”‘’]/g,"").replace(/\([^)]*\)/g," ").replace(/[^\p{L}\p{N}\s]/gu," ").replace(/\s+/g," ").trim();}
function decodeHtml(s){return s.replace(/&#(\d+);/g,(_,d)=>String.fromCodePoint(+d)).replace(/&mdash;/g,"—").replace(/&amp;/g,"&").replace(/&#39;/g,"'");}

const DB={host:"127.0.0.1",port:15433,user:"sumicowork",password: process.env.DB_PASSWORD || "",database:"hoyomusic"};

async function main(){
  const ds=JSON.parse(fs.readFileSync("C:/Users/sumi/WebstormProjects/HoYoMusic/backend/scripts/fandomMusicSource/out/music-source-dataset.json","utf8"));
  // Flatten HSR tracks  
  const allHsr=[];
  for(const k of Object.keys(ds.hsr)) allHsr.push(...ds.hsr[k]);
  console.log("HSR dataset tracks:",allHsr.length);
  
  const client=new Client(DB);
  await client.connect();

  // Load DB tracks
  const dbRes=await client.query(`SELECT t.id,t.title_en FROM tracks t JOIN albums a ON a.id=t.album_id WHERE a.game_id=2 AND t.title_en IS NOT NULL`);
  const dbMap=new Map();
  for(const r of dbRes.rows) dbMap.set(normAgg(r.title_en),r.id);
  console.log("DB tracks with title_en:",dbMap.size);

  // Load nodes
  const nodeRes=await client.query(`SELECT id,game_id,category_id,en_name,translation_status FROM music_source_nodes WHERE game_id=2`);
  const nodeExact=new Map();
  const nodeByLeaf=new Map();
  for(const n of nodeRes.rows){
    if(!n.en_name)continue;
    nodeExact.set(`${n.game_id}|${n.category_id}|${n.en_name.toLowerCase().trim()}`,{id:n.id,status:n.translation_status});
    const k=`${n.game_id}|${n.en_name.toLowerCase().trim()}`;
    if(!nodeByLeaf.has(k))nodeByLeaf.set(k,[]);
    nodeByLeaf.get(k).push({id:n.id,catId:n.category_id,status:n.translation_status});
  }

  // Categories
  const catRes=await client.query(`SELECT id,name FROM music_source_categories`);
  const catByName=new Map();
  for(const r of catRes.rows) catByName.set(r.name.toLowerCase(),r.id);

  // Existing edges for dedup
  const existRes=await client.query(`SELECT track_id,node_id FROM track_music_sources tms JOIN music_source_nodes mn ON mn.id=tms.node_id WHERE mn.game_id=2`);
  const existSet=new Set();
  for(const r of existRes.rows) existSet.add(`${r.track_id}|${r.node_id}`);

  // Match with fix
  let newEdges=0;
  let matched=0,alreadyHas=0;
  for(const t of allHsr){
    // FIX 1: Decode HTML entities in ol.en
    const olEn=t.otherLanguages?.en||"";
    // FIX 2: Try decoded ol.en first, then pageTitle
    let key=olEn?normAgg(decodeHtml(olEn)):"";
    let trackId=key?dbMap.get(key):undefined;
    if(!trackId&&t.pageTitle){
      key=normAgg(decodeHtml(t.pageTitle));
      trackId=dbMap.get(key);
    }
    if(!trackId)continue;
    matched++;
    const locs=t.locations||[];
    for(const loc of locs){
      const catKey=loc.kind||loc.dimension;
      const pathArr=loc.resolvedPath||loc.enPath||[];
      if(!catKey||!pathArr.length)continue;
      const leaf=pathArr[pathArr.length-1];
      let catId=catByName.get(catKey.toLowerCase());
      if(!catId&&catKey==="version")catId=catByName.get("promo");
      if(!catId)continue;
      let node=nodeExact.get(`2|${catId}|${leaf.toLowerCase().trim()}`);
      if(!node){
        const cand=nodeByLeaf.get(`2|${leaf.toLowerCase().trim()}`)||[];
        const sameCat=cand.find(c=>c.catId===catId);
        node=sameCat||(cand.length?cand[0]:undefined);
      }
      if(!node)continue;
      const sig=`${trackId}|${node.id}`;
      if(existSet.has(sig)){alreadyHas++;continue;}
      // Insert new edge
      try{
        await client.query(
          `INSERT INTO track_music_sources (track_id,game_id,category_id,node_id,display_order) VALUES ($1,$2,$3,$4,0) ON CONFLICT DO NOTHING`,
          [trackId,2,catId,node.id]
        );
        newEdges++;
        existSet.add(sig);
      }catch(e){
        // skip dupes silently
      }
    }
  }
  
  console.log("Matched tracks:",matched);
  console.log("Already existing edges:",alreadyHas);
  console.log("New edges inserted:",newEdges);
  
  // Verify coverage
  const cov=await client.query(`SELECT count(DISTINCT t.id) as t, count(DISTINCT tms.track_id) as w FROM tracks t JOIN albums a ON a.id=t.album_id LEFT JOIN track_music_sources tms ON tms.track_id=t.id WHERE a.game_id=2`);
  console.log("\nHSR coverage:",cov.rows[0].w,"/",cov.rows[0].t,"=",Math.round(cov.rows[0].w/cov.rows[0].t*100)+"%");
  
  // Update tree orphans
  await client.query(`DELETE FROM music_source_nodes WHERE game_id=2 AND NOT EXISTS (SELECT 1 FROM track_music_sources WHERE node_id=music_source_nodes.id)`);
  const delNode=await client.query("SELECT count(*) as n FROM music_source_nodes WHERE game_id=2");
  console.log("Orphans cleaned. Nodes now:",delNode.rows[0].n);
  
  await client.end();
}
main().catch(e=>console.error(e.message));
