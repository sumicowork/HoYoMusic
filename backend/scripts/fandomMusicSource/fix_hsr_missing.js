/**
 * Fix remaining HSR edges: multi-strategy matching for the 141 mismatched tracks.
 * Strategy 1: Match dataset ol.zhs ↔ DB title_cn (Chinese name matching)
 * Strategy 2: Token overlap (all words from one appear in the other)
 */
const {Client}=require("C:/Users/sumi/WebstormProjects/HoYoMusic/backend/node_modules/pg");
const fs=require("fs");

const DB={host:"127.0.0.1",port:15433,user:"sumicowork",password: process.env.DB_PASSWORD || "",database:"hoyomusic"};

function norm(s){return s.toLowerCase().replace(/\s+/g," ").trim();}
function normAgg(s){return (s||"").toLowerCase().replace(/\p{P}/gu," ").replace(/\s+/g," ").trim();}
function tokens(s){return new Set(normAgg(s).split(/\s+/).filter(t=>t.length>0));}
function overlap(a,b){const ta=tokens(a),tb=tokens(b);let o=0;for(const t of ta)if(tb.has(t))o++;return o/Math.min(ta.size,tb.size);}

async function main(){
  const ds=JSON.parse(fs.readFileSync("C:/Users/sumi/WebstormProjects/HoYoMusic/backend/scripts/fandomMusicSource/out/music-source-dataset.json","utf8"));
  const allHsr=[];
  for(const k of Object.keys(ds.hsr)) allHsr.push(...ds.hsr[k]);
  const withLoc=allHsr.filter(x=>x.locations&&x.locations.length>0);
  console.log("Dataset HSR with locations:",withLoc.length);

  // Build dataset lookup by: norm(zhs), norm(en), norm(pageTitle)
  const byZhs=new Map(), byEn=new Map(), byPage=new Map();
  for(const t of withLoc){
    const zh=t.otherLanguages?.zhs||t.otherLanguages?.zht;
    const en=t.otherLanguages?.en||"";
    if(zh)byZhs.set(norm(zh),t);
    if(en)byEn.set(normAgg(en),t);
    if(t.pageTitle)byPage.set(normAgg(t.pageTitle),t);
  }

  const client=new Client(DB);
  await client.connect();

  // Load nodes
  const nodeRes=await client.query(`SELECT id,game_id,category_id,en_name FROM music_source_nodes WHERE game_id=2`);
  const nodeExact=new Map(), nodeByLeaf=new Map();
  for(const n of nodeRes.rows){
    if(!n.en_name)continue;
    nodeExact.set(`${n.game_id}|${n.category_id}|${n.en_name.toLowerCase().trim()}`,n.id);
    const k=`${n.game_id}|${n.en_name.toLowerCase().trim()}`;
    if(!nodeByLeaf.has(k))nodeByLeaf.set(k,[]);
    nodeByLeaf.get(k).push({id:n.id,catId:n.category_id});
  }
  const catRes=await client.query(`SELECT id,name FROM music_source_categories`);
  const catByName=new Map();
  for(const r of catRes.rows) catByName.set(r.name.toLowerCase(),r.id);

  // Get the 141 unmatched tracks
  const missRes=await client.query(`
    SELECT t.id,t.title,t.title_en,t.title_cn FROM tracks t JOIN albums a ON a.id=t.album_id
    WHERE a.game_id=2 AND (t.title_en IS NOT NULL AND t.title_en!='')
    AND NOT EXISTS (SELECT 1 FROM track_music_sources tms WHERE tms.track_id=t.id)
    ORDER BY t.id`);
  console.log("Unmatched tracks:",missRes.rowCount);

  let zhMatch=0, tokenMatch=0, still=0;
  const inserts=[];

  for(const r of missRes.rows){
    let dsTrack=null, matchType="";

    // Strategy 1: Chinese name match
    const cn=(r.title_cn||r.title||"").replace(/[\(（][^）)]*[\)）]/g,"").trim();
    if(cn&&byZhs.has(norm(cn))){
      dsTrack=byZhs.get(norm(cn));
      matchType="zh";
    }
    // Strategy 2: exact English match (should have been caught, but check again)
    if(!dsTrack){
      const en=k=>r.title_en?normAgg(r.title_en):null;
      if(en&&byEn.has(en)){dsTrack=byEn.get(en);matchType="en_exact";}
    }
    // Strategy 3: token overlap >= 0.8
    if(!dsTrack&&r.title_en){
      for(const t of withLoc){
        const en=t.otherLanguages?.en||"";
        if(en&&overlap(en,r.title_en)>=0.8){dsTrack=t;matchType="token80";break;}
      }
    }
    // Strategy 4: pageTitle overlap
    if(!dsTrack&&r.title_en){
      for(const t of withLoc){
        if(t.pageTitle&&overlap(t.pageTitle,r.title_en)>=0.8){dsTrack=t;matchType="token80_page";break;}
      }
    }

    if(dsTrack){
      const locs=dsTrack.locations||[];
      for(const loc of locs){
        const catKey=loc.kind||loc.dimension;
        const pathArr=loc.resolvedPath||loc.enPath||[];
        if(!catKey||!pathArr.length)continue;
        const leaf=pathArr[pathArr.length-1];
        let catId=catByName.get(catKey.toLowerCase());
        if(!catId&&catKey==="version")catId=catByName.get("promo");
        if(!catId)continue;
        let nid=nodeExact.get(`2|${catId}|${leaf.toLowerCase().trim()}`);
        if(!nid){
          const cand=nodeByLeaf.get(`2|${leaf.toLowerCase().trim()}`)||[];
          const sc=cand.find(c=>c.catId===catId);
          nid=sc?sc.id:(cand.length?cand[0].id:undefined);
        }
        if(nid)inserts.push([r.id,2,catId,nid]);
      }
      if(matchType==="zh")zhMatch++;
      else tokenMatch++;
    }else{still++;}
  }

  // Batch insert
  let done=0;
  for(const ins of inserts){
    try{
      await client.query(
        "INSERT INTO track_music_sources (track_id,game_id,category_id,node_id,display_order) VALUES ($1,$2,$3,$4,0) ON CONFLICT DO NOTHING",
        ins);
      done++;
    }catch(e){}
  }

  console.log("\nMatched by Chinese:",zhMatch,"| by token:",tokenMatch,"| still unmatched:",still);
  console.log("Edges inserted:",done);

  // Final coverage
  const cov=await client.query(`
    SELECT count(DISTINCT t.id) as t, count(DISTINCT tms.track_id) as w
    FROM tracks t JOIN albums a ON a.id=t.album_id
    LEFT JOIN track_music_sources tms ON tms.track_id=t.id WHERE a.game_id=2`);
  console.log("Coverage:",cov.rows[0].w,"/",cov.rows[0].t,"=",Math.round(cov.rows[0].w/cov.rows[0].t*100)+"%");

  await client.end();
}
main().catch(e=>console.error(e.message));
