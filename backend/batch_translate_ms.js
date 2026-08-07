// Batch check fandom translations for English-only music_source_nodes
const {Client}=require("C:/Users/sumi/WebstormProjects/HoYoMusic/backend/node_modules/pg");
const {getWikitext,parseOtherLanguages}=require("./scripts/fandomMusicSource/fandomClient");

async function main(){
  const c=new Client({host:"localhost",port:15433,user:"sumicowork",password: process.env.DB_PASSWORD || "",database:"hoyomusic"});
  await c.connect();

  const r=await c.query(`SELECT id, name FROM music_source_nodes WHERE game_id=1
    AND EXISTS (SELECT 1 FROM track_music_sources tms WHERE tms.node_id=music_source_nodes.id)
    AND (name IS NOT NULL AND name!='')
    AND name !~ '[\u4e00-\u9fff]' ORDER BY id`);
  
  console.log("Checking",r.rowCount,"nodes...\n");
  let found=0, noPage=0, hasPageNoTrans=0, errors=0;
  const updates=[];

  for(const row of r.rows){
    const term=row.name;
    // Skip garbage names
    if(term.length<3||term===','||term==='In'||term==='、'){noPage++;continue;}
    try{
      const wt=await getWikitext("genshin-impact",term);
      const langs=parseOtherLanguages(wt);
      const zh=langs.zhs||langs.zht||null;
      if(zh){
        console.log("✅ #"+row.id,zh,"←",term.slice(0,60));
        updates.push({id:row.id,zh});
        found++;
      } else {
        hasPageNoTrans++;
      }
    }catch(e){
      if(e.message.includes("missingtitle")||e.message.includes("invalid")){
        noPage++;
      } else {
        errors++;
        if(errors<=5) console.log("⚠️ #"+row.id,term.slice(0,50),"-",e.message.slice(0,40));
      }
    }
  }

  console.log("\n════════");
  console.log("总数:",r.rowCount);
  console.log("找到翻译:",found);
  console.log("无fandom页面:",noPage);
  console.log("有页面但无翻译:",hasPageNoTrans);
  console.log("error:",errors);

  // Apply updates
  if(updates.length>0){
    console.log("\nApplying updates...");
    for(const u of updates){
      await c.query("UPDATE music_source_nodes SET name=$1, translation_status='translated' WHERE id=$2",[u.zh,u.id]);
      console.log("  #"+u.id,"→",u.zh);
    }
  }
  await c.end();
}
main().catch(e=>console.error(e.message));
