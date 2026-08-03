// Final fuzzy match for remaining HSR tracks
const {Client}=require("C:/Users/sumi/WebstormProjects/HoYoMusic/backend/node_modules/pg");
const fs=require("fs");

function levenshtein(a,b){
  const m=a.length,n=b.length;
  const dp=Array.from({length:m+1},()=>Array(n+1).fill(0));
  for(let i=0;i<=m;i++)dp[i][0]=i;
  for(let j=0;j<=n;j++)dp[0][j]=j;
  for(let i=1;i<=m;i++)for(let j=1;j<=n;j++)dp[i][j]=Math.min(dp[i-1][j]+1,dp[i][j-1]+1,dp[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
  return dp[m][n];
}
function norm(s){return s.toLowerCase().replace(/[^\p{L}\p{N}]/gu," ").replace(/\s+/g," ").trim();}
function sim(a,b){const na=norm(a),nb=norm(b);if(!na||!nb)return 0;return 1-levenshtein(na,nb)/Math.max(na.length,nb.length);}

(async()=>{
const ds=JSON.parse(fs.readFileSync("./scripts/fandomMusicSource/out/music-source-dataset.json","utf8"));
const allHsr=[];for(const k of Object.keys(ds.hsr))allHsr.push(...ds.hsr[k]);
const withLoc=allHsr.filter(x=>x.locations&&x.locations.length>0);

const c=new Client({host:"127.0.0.1",port:15433,user:"sumicowork",password: process.env.DB_PASSWORD || "",database:"hoyomusic"});
await c.connect();

const missRes=await c.query(`SELECT t.id,t.title,t.title_en FROM tracks t JOIN albums a ON a.id=t.album_id WHERE a.game_id=2 AND (t.title_en IS NOT NULL AND t.title_en!='') AND NOT EXISTS (SELECT 1 FROM track_music_sources tms WHERE tms.track_id=t.id) ORDER BY t.id`);
console.log("Remaining:",missRes.rowCount);

// Load nodes
const nodeRes=await c.query("SELECT id,game_id,category_id,en_name FROM music_source_nodes WHERE game_id=2");
const nodeExact=new Map(),nodeByLeaf=new Map();
for(const n of nodeRes.rows){if(!n.en_name)continue;nodeExact.set(n.game_id+"|"+n.category_id+"|"+n.en_name.toLowerCase().trim(),n.id);const k=n.game_id+"|"+n.en_name.toLowerCase().trim();if(!nodeByLeaf.has(k))nodeByLeaf.set(k,[]);nodeByLeaf.get(k).push({id:n.id,catId:n.category_id});}
const catRes=await c.query("SELECT id,name FROM music_source_categories");
const catByName=new Map();
for(const r of catRes.rows)catByName.set(r.name.toLowerCase(),r.id);

let found=0, inserted=0;
for(const r of missRes.rows){
  let best=null,bestSim=0;
  for(const t of withLoc){
    const en=t.otherLanguages?.en||t.pageTitle||"";
    if(!en)continue;
    const s=sim(en,r.title_en);
    if(s>bestSim){bestSim=s;best=t;}
    if(t.pageTitle&&t.pageTitle!==en){const s2=sim(t.pageTitle,r.title_en);if(s2>bestSim){bestSim=s2;best=t;}}
  }
  if(bestSim>=0.85){
    const en=best.otherLanguages?.en||best.pageTitle;
    console.log("  ✅ #"+r.id,(bestSim*100).toFixed(0)+"%",r.title_en.slice(0,40),"→",(en||"").slice(0,40));
    found++;
    for(const loc of best.locations){
      const catKey=loc.kind||loc.dimension;const pathArr=loc.resolvedPath||loc.enPath||[];
      if(!catKey||!pathArr.length)continue;
      const leaf=pathArr[pathArr.length-1];let catId=catByName.get(catKey.toLowerCase());
      if(!catId)catId=catByName.get("promo");if(!catId)continue;
      let nid=nodeExact.get("2|"+catId+"|"+leaf.toLowerCase().trim());
      if(!nid){const cand=nodeByLeaf.get("2|"+leaf.toLowerCase().trim())||[];const sc=cand.find(x=>x.catId===catId);nid=sc?sc.id:(cand.length?cand[0].id:undefined);}
      if(nid)try{await c.query("INSERT INTO track_music_sources (track_id,game_id,category_id,node_id,display_order) VALUES ($1,$2,$3,$4,0) ON CONFLICT DO NOTHING",[r.id,2,catId,nid]);inserted++;}catch(e){}
    }
  }else console.log("  ❌ #"+r.id,(bestSim*100).toFixed(0)+"%",r.title_en.slice(0,40));
}
console.log("\nMatched:",found,"| Edges inserted:",inserted);
const cov=await c.query("SELECT count(DISTINCT t.id) as t,count(DISTINCT tms.track_id) as w FROM tracks t JOIN albums a ON a.id=t.album_id LEFT JOIN track_music_sources tms ON tms.track_id=t.id WHERE a.game_id=2");
console.log("Coverage:",cov.rows[0].w,"/",cov.rows[0].t,"=",Math.round(cov.rows[0].w/cov.rows[0].t*100)+"%");
await c.end();
})();
