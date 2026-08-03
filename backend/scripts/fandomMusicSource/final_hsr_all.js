/**
 * FINAL comprehensive HSR edge fixer
 * Combines all strategies: exact match, Chinese match, token overlap, fuzzy
 */
const {Client}=require("C:/Users/sumi/WebstormProjects/HoYoMusic/backend/node_modules/pg");
const fs=require("fs");
const ds=JSON.parse(fs.readFileSync("./scripts/fandomMusicSource/out/music-source-dataset.json","utf8"));
const allHsr=[];for(const k of Object.keys(ds.hsr))allHsr.push(...ds.hsr[k]);
const withLoc=allHsr.filter(x=>x.locations&&x.locations.length>0);

function n(s){return (s||"").toLowerCase().replace(/[^\p{L}\p{N}]/gu," ").replace(/\s+/g," ").trim();}
function normAgg(s){return (s||"").toLowerCase().replace(/[("\u201C\u201D\u2018\u2019"]/g,"").replace(/\([^)]*\)/g," ").replace(/[^\p{L}\p{N}\s]/gu," ").replace(/\s+/g," ").trim();}
function decodeHtml(s){return s.replace(/&#(\d+);/g,(_,d)=>String.fromCodePoint(+d)).replace(/&mdash;/g,"\u2014").replace(/&amp;/g,"&").replace(/&#39;/g,"'");}
function overlap(a,b){const ta=n(a).split(" ").filter(t=>t.length>1),tb=n(b).split(" ").filter(t=>t.length>1);if(!ta.length||!tb.length)return 0;let o=0;for(const t of ta)if(tb.includes(t))o++;return o/Math.max(ta.length,tb.length);}
function levenshtein(a,b){const na=n(a),nb=n(b);if(!na||!nb)return 0;const m=na.length,c=nb.length,dp=Array(m+1).fill().map(()=>Array(c+1).fill(0));for(let i=0;i<=m;i++)dp[i][0]=i;for(let j=0;j<=c;j++)dp[0][j]=j;for(let i=1;i<=m;i++)for(let j=1;j<=c;j++)dp[i][j]=Math.min(dp[i-1][j]+1,dp[i][j-1]+1,dp[i-1][j-1]+(na[i-1]===nb[j-1]?0:1));return 1-dp[m][c]/Math.max(m,c);}

(async()=>{
const c=new Client({host:"127.0.0.1",port:15433,user:"sumicowork",password: process.env.DB_PASSWORD || "",database:"hoyomusic"});
await c.connect();

// Load DB tracks
const dbRes=await c.query("SELECT t.id,t.title_en,t.title_cn FROM tracks t JOIN albums a ON a.id=t.album_id WHERE a.game_id=2");
const dbById=new Map(), dbByEn=new Map(), dbByCn=new Map();
for(const r of dbRes.rows){
  dbById.set(r.id,r);
  if(r.title_en)dbByEn.set(normAgg(r.title_en),r);
  if(r.title_cn)dbByCn.set(r.title_cn.replace(/[\\(\\)（\）]/g,"").trim(),r);
}

// Load nodes
const nodeRes=await c.query("SELECT id,game_id,category_id,en_name FROM music_source_nodes WHERE game_id=2");
const nodeExact=new Map(), nodeByLeaf=new Map();
for(const n of nodeRes.rows){
  if(!n.en_name)continue;
  nodeExact.set(n.game_id+"|"+n.category_id+"|"+n.en_name.toLowerCase().trim(),n.id);
  const k=n.game_id+"|"+n.en_name.toLowerCase().trim();
  if(!nodeByLeaf.has(k))nodeByLeaf.set(k,[]);
  nodeByLeaf.get(k).push({id:n.id,catId:n.category_id});
}
const catRes=await c.query("SELECT id,name FROM music_source_categories");
const catByName=new Map();
for(const r of catRes.rows)catByName.set(r.name.toLowerCase(),r.id);

// Match every DB track to dataset
let edges=0, matched=0;
for(const [id,r] of dbById){
  if(!r.title_en)continue;
  let best=null;
  
  // Strategy 1: exact normAgg match
  const key=normAgg(decodeHtml(r.title_en));
  for(const t of withLoc){
    const en=decodeHtml(t.otherLanguages?.en||"");
    if(en&&normAgg(en)===key){best=t;break;}
    if(t.pageTitle&&normAgg(decodeHtml(t.pageTitle))===key){best=t;break;}
  }
  // Strategy 2: Chinese name match
  if(!best&&r.title_cn){
    const cn=r.title_cn.replace(/[\\(\\)（\）]/g,"").trim();
    for(const t of withLoc){
      const zh=(t.otherLanguages?.zhs||t.otherLanguages?.zht||"").replace(/[\\(\\)（\）]/g,"").trim();
      if(zh===cn){best=t;break;}
    }
  }
  // Strategy 3: token overlap >= 0.8
  if(!best){
    let bestScore=0;
    for(const t of withLoc){
      const en=decodeHtml(t.otherLanguages?.en||"");
      if(!en)continue;
      const s=overlap(en,r.title_en);
      if(s>bestScore){bestScore=s;best=t;}
      if(t.pageTitle){const s2=overlap(t.pageTitle,r.title_en);if(s2>bestScore){bestScore=s2;best=t;}}
    }
    if(bestScore>=0.8){}else best=null;
  }
  // Strategy 4: fuzzy >= 0.9
  if(!best){
    let bestScore=0;
    for(const t of withLoc){
      const en=decodeHtml(t.otherLanguages?.en||t.pageTitle||"");
      if(!en)continue;
      const s=levenshtein(en,r.title_en);
      if(s>bestScore){bestScore=s;best=t;}
    }
    if(bestScore>=0.9){}else best=null;
  }
  
  if(!best)continue;
  matched++;
  for(const loc of best.locations){
    const catKey=loc.kind||loc.dimension;
    const pathArr=loc.resolvedPath||loc.enPath||[];
    if(!catKey||!pathArr.length)continue;
    const leaf=pathArr[pathArr.length-1];
    let catId=catByName.get(catKey.toLowerCase());
    if(!catId&&catKey==="version")catId=catByName.get("promo");
    if(!catId)continue;
    let nid=nodeExact.get("2|"+catId+"|"+leaf.toLowerCase().trim());
    if(!nid){
      const cand=nodeByLeaf.get("2|"+leaf.toLowerCase().trim())||[];
      const sc=cand.find(x=>x.catId===catId);
      nid=sc?sc.id:(cand.length?cand[0].id:undefined);
    }
    if(nid){
      await c.query("INSERT INTO track_music_sources (track_id,game_id,category_id,node_id,display_order) VALUES ($1,$2,$3,$4,0) ON CONFLICT (track_id,node_id) DO NOTHING",[id,2,catId,nid]);
      edges++;
    }
  }
}

console.log("Matched tracks:",matched,"| Edges inserted:",edges);
const cov=await c.query("SELECT count(DISTINCT t.id) as t,count(DISTINCT tms.track_id) as w FROM tracks t JOIN albums a ON a.id=t.album_id LEFT JOIN track_music_sources tms ON tms.track_id=t.id WHERE a.game_id=2");
console.log("Coverage:",cov.rows[0].w,"/",cov.rows[0].t,"=",Math.round(cov.rows[0].w/cov.rows[0].t*100)+"%");
await c.end();
})();
