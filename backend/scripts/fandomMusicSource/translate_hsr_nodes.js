// Batch translate HSR English-only nodes via fandom
const {Client}=require("C:/Users/sumi/WebstormProjects/HoYoMusic/backend/node_modules/pg");
const {getWikitext,parseOtherLanguages}=require("C:/Users/sumi/WebstormProjects/HoYoMusic/backend/scripts/fandomMusicSource/fandomClient");

(async()=>{
const c=new Client({host:"127.0.0.1",port:15433,user:"sumicowork",password: process.env.DB_PASSWORD || "",database:"hoyomusic"});
await c.connect();

const res=await c.query(`SELECT id,en_name FROM music_source_nodes WHERE game_id=2 AND EXISTS (SELECT 1 FROM track_music_sources tms WHERE tms.node_id=music_source_nodes.id) AND (name IS NULL OR name='' OR name !~ '[\u4e00-\u9fff]')`);
console.log("HSR English-only:",res.rowCount);

let fixed=0;
for(const r of res.rows){
  const term=r.en_name||"";
  if(term.length<3)continue;
  const clean=term.replace(/\s*\([^)]*\)$/,"").trim();
  let zh=null;
  try{
    const wt=await getWikitext("honkai-star-rail",clean);
    const langs=parseOtherLanguages(wt);
    zh=langs.zhs||langs.zht||null;
  }catch(e){
    const shorter=clean.split(",")[0].trim();
    if(shorter!==clean){
      try{
        const wt2=await getWikitext("honkai-star-rail",shorter);
        const langs2=parseOtherLanguages(wt2);
        zh=langs2.zhs||langs2.zht||null;
      }catch(e2){}
    }
  }
  if(zh){
    await c.query("UPDATE music_source_nodes SET name=$1 WHERE id=$2",[zh,r.id]);
    fixed++;
  }
}
console.log("Translated:",fixed);

const check=await c.query("SELECT count(*) FROM music_source_nodes WHERE game_id=2 AND EXISTS (SELECT 1 FROM track_music_sources tms WHERE tms.node_id=music_source_nodes.id) AND name IS NOT NULL AND name!='' AND name ~ '[\u4e00-\u9fff]'");
const total=await c.query("SELECT count(*) as n FROM music_source_nodes WHERE game_id=2 AND EXISTS (SELECT 1 FROM track_music_sources tms WHERE tms.node_id=music_source_nodes.id)");
console.log("Chinese:",check.rows[0].count,"/",total.rows[0].n,"=",Math.round(check.rows[0].count/total.rows[0].n*100)+"%");
await c.end();
})();
