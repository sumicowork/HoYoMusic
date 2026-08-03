import { Client } from "pg";
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function main() {
  const c = new Client({
    host: process.env.DB_HOST || "127.0.0.1",
    port: parseInt(process.env.DB_PORT || "15433"),
    user: process.env.DB_USER || "sumicowork",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "hoyomusic",
  });
  await c.connect();

  const res = await c.query(`
    SELECT mc.name cat, mn.id, mn.name, mn.en_name FROM music_source_nodes mn 
    JOIN music_source_categories mc ON mc.id=mn.category_id 
    WHERE mc.game_id=3 AND mn.name ~ '[\\u4e00-\\u9fff]' AND mn.name ~ '[A-Za-z]{3,}'
    ORDER BY mn.id
  `);

  const others: string[] = [];
  let combat = 0, commission = 0, ad = 0, hollowCretan = 0, movieStory = 0, battle = 0;
  let epDemo = 0, teaser = 0;

  for (const r of res.rows) {
    const n: string = r.name;
    
    if (n.match(/EP|Character Demo|Animated Short|Agent Story|MV|Idle Animations/) && n.match(/- /) && !n.match(/combat|委托|空洞|story scene|advertisement|Battle/)) {
      epDemo++;
      continue;
    }
    if (n.match(/^Version \d.*Teaser|^Second Season Preview|^Season \d Preview/) && !n.match(/combat|委托/)) {
      teaser++;
      continue;
    }
    if (n.match(/战斗 scenario|战斗 situation|战斗 scenarios/)) { combat++; continue; }
    if (n.match(/委托\b.*\b委托|a 委托|委托,|委托 HDD|委托 HD/)) { commission++; continue; }
    if (n.match(/advertisement in login screen/)) { ad++; continue; }
    if (n.match(/空洞|Hyper |Cretan |Lemnian |Ballet Twins|Outer Ring/)) { hollowCretan++; continue; }
    if (n.match(/story scene|Story scenes|movie in/)) { movieStory++; continue; }
    if (n.match(/Battle with|Battle against|Fight against|Fight with/)) { battle++; continue; }
    
    others.push(n);
  }

  console.log(`=== "其他" 分类: ${others.length} 个节点 ===\n`);
  for (let i = 0; i < others.length; i++) {
    console.log(`${i+1}. ${others[i]}`);
  }
  
  console.log(`\n已排除: EP/Demo ${epDemo} | Teaser ${teaser} | combat ${combat} | commission ${commission} | ad ${ad} | hollow ${hollowCretan} | movie/story ${movieStory} | battle ${battle}`);
  await c.end();
}

main().catch(e => { console.error(e); process.exit(1); });
