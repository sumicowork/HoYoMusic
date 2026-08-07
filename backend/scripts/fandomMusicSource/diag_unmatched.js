// Show DB vs fandom for remaining unmatched HSR tracks
const {Client}=require("C:/Users/sumi/WebstormProjects/HoYoMusic/backend/node_modules/pg");
const fs=require("fs");
const ds=JSON.parse(fs.readFileSync("./scripts/fandomMusicSource/out/music-source-dataset.json","utf8"));
const allHsr=[];for(const k of Object.keys(ds.hsr))allHsr.push(...ds.hsr[k]);
function n(s){return (s||"").toLowerCase().replace(/[^\p{L}\p{N}]/gu," ").replace(/\s+/g," ").trim();}

(async()=>{
const c=new Client({host:"127.0.0.1",port:15433,user:"sumicowork",password: process.env.DB_PASSWORD || "",database:"hoyomusic"});
await c.connect();
const missRes=await c.query(`SELECT t.id,t.title,t.title_en FROM tracks t JOIN albums a ON a.id=t.album_id WHERE a.game_id=2 AND (t.title_en IS NOT NULL AND t.title_en!='') AND NOT EXISTS (SELECT 1 FROM track_music_sources tms WHERE tms.track_id=t.id) ORDER BY t.id LIMIT 25`);

for(const r of missRes.rows){
  console.log("\nDB #"+r.id,":",r.title_en,"| db_title:",r.title.slice(0,55));
  let best=null;
  for(const t of allHsr){
    if(!t.locations||!t.locations.length)continue;
    const en=n(t.otherLanguages?.en||"");
    const pg=n(t.pageTitle||"");
    const db=n(r.title_en||"");
    if(en&&(en.includes(db)||db.includes(en))){best=t;break;}
    if(pg&&(pg.includes(db)||db.includes(pg))){best=t;break;}
  }
  if(best){
    console.log("  ✅ fandom:",best.otherLanguages?.en||best.pageTitle,"| locations:",best.locations.length);
  } else {
    let closest=null,closestSim=0;
    for(const t of allHsr){
      const en=n(t.otherLanguages?.en||t.pageTitle||"");if(!en)continue;
      const dbn=n(r.title_en||"");
      let s=0;const tokens=en.split(" ");for(const tk of tokens)if(dbn.includes(tk))s++;
      if(s>closestSim){closestSim=s;closest=t;}
    }
    console.log("  ❌ closest:",(closest?.otherLanguages?.en||closest?.pageTitle||"(null)"),"| tokens:",closestSim);
  }
}
const cnt=await c.query("SELECT count(*) as n FROM tracks t JOIN albums a ON a.id=t.album_id WHERE a.game_id=2 AND (t.title_en IS NOT NULL AND t.title_en!='') AND NOT EXISTS (SELECT 1 FROM track_music_sources tms WHERE tms.track_id=t.id)");
console.log("\nTotal unmatched:",cnt.rows[0].n);
await c.end();
})();
