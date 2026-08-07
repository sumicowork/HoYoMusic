// Extract English title_en from fandom HSR wiki infobox for tracks missing title_en
const {Client}=require("C:/Users/sumi/WebstormProjects/HoYoMusic/backend/node_modules/pg");
const {getWikitext}=require("./scripts/fandomMusicSource/fandomClient");

(async()=>{
const c=new Client({host:"127.0.0.1",port:15433,user:"sumicowork",password: process.env.DB_PASSWORD || "",database:"hoyomusic"});
await c.connect();

const res=await c.query(`SELECT t.id,t.title,t.title_cn FROM tracks t JOIN albums a ON a.id=t.album_id WHERE a.game_id=2 AND (t.title_en IS NULL OR t.title_en='')`);
console.log("捞",res.rowCount,"首...\n");

let fixed=0;
for(const r of res.rows){
  const cn=r.title_cn||r.title.replace(/[\(（][^）)]*[\)）]/g,"").trim().replace(/[《》]/g,"");
  if(!cn||cn.length<2){console.log("  ❌ #"+r.id,"无有效中文名");continue;}

  let found=false;
  // Step 1: try fandom page by Chinese name
  try{
    const wt=await getWikitext("honkai-star-rail",cn);
    if(wt){
      // Strategy A: previous/next track in infobox
      let m=wt.match(/previous\s*=\s*\s*([A-Z][A-Za-z\s!]+)/);
      if(!m) m=wt.match(/next\s*=\s*\s*([A-Z][A-Za-z\s!]+)/);
      // Strategy B: album field
      if(!m) m=wt.match(/\|\s*album\s*=\s*([A-Z][A-Za-z\s!\-:]+)/);
      // Strategy C: image filename 
      if(!m) m=wt.match(/\|\s*image\s*=\s*([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*)/);

      if(m){
        let en=m[1].trim().replace(/\s*[\(（].*[\)）]$/,"").replace(/\|\s*.*/,"");
        if(en&&en.length>=3){
          await c.query("UPDATE tracks SET title_en=$1 WHERE id=$2",[en,r.id]);  
          console.log("  ✅ #"+r.id,en,"←",cn); fixed++; found=true;
        }
      }else console.log("  ❌ #"+r.id,cn,"- 页面有但无可用en");
    }
  }catch(e){
    const stripped=cn.replace(/\s*[\(（](伴奏|和声|中文|英文|日文|韩文|安可).*/,"").trim();
    if(stripped!==cn){
      try{
        const wt2=await getWikitext("honkai-star-rail",stripped);
        let m=wt2.match(/previous\s*=\s*\s*([A-Z][A-Za-z\s!]+)/);
        if(!m) m=wt2.match(/\|\s*album\s*=\s*([A-Z][A-Za-z\s!\-:]+)/);
        if(m){
          let en=m[1].trim().replace(/\s*[\(（].*[\)）]$/,"");
          if(en){
            await c.query("UPDATE tracks SET title_en=$1 WHERE id=$2",[en,r.id]);
            console.log("  ✅ #"+r.id,en,"←",r.title.slice(0,30),"(stripped)");
            fixed++; found=true;
          }
        }else console.log("  ❌ #"+r.id,r.title.slice(0,30),"- no en in infobox");
      }catch(e2){console.log("  ❌ #"+r.id,cn,"- no page even stripped");}
    }else{console.log("  ❌ #"+r.id,cn,"- no fandom page");}
  }
}
// Report remaining
const remain=await c.query("SELECT count(*) as n FROM tracks t JOIN albums a ON a.id=t.album_id WHERE a.game_id=2 AND (t.title_en IS NULL OR t.title_en='')");
console.log("\n捞到:",fixed,"首 | 剩余:",remain.rows[0].n,"首");
await c.end();
})();
