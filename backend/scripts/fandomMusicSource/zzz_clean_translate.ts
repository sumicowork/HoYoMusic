import { Client } from "pg";
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const TRANSLATIONS: Record<string, string> = {
  "Zenless Zone Zero": "绝区零",
  "Rhythm Rave": "音跃狂潮",
  "Agent Story": "代理人秘闻",
  "Animated Short Film": "动画短片",
  // MV/EP: format markers, no translation needed
  "MV": "MV",
  "EP": "EP",
  // Removed (no wiki OL): Character Demo, Animated Short Film, Theme Song, Opening Theme, Teaser, movie in
  
  // Wiki-verified character names
  "Asaba Harumasa": "浅羽悠真",
  "Hoshimi Miyabi": "星见雅",
  "Ju Fufu": "橘福福",
  "Nangong Yu": "南宫羽",
  "Tsukishiro Yanagi": "月城柳",
  "Ukinami Yuzuha": "浮波柚叶",
  "Zhu Yuan": "朱鸢",
  "Astra Yao": "耀嘉音",
  "Qingyi": "青衣",
  "Ye Shiyuan": "叶释渊",
  "Komano Manato": "狛野真斗",
  "Hugo Vlad": "雨果・维拉德",
  "Hugo": "雨果",
  "Sarah Floren": "莎拉・弗洛伦",
  "Pan Yinhu": "潘引壶",
  "Banyue": "般岳",
  "Ellen Joe": "艾莲・乔",
  "Ellen": "艾莲",
  "Caesar King": "凯撒・金",
  "Caesar": "凯撒",
  "Lighter": "莱特",
  "Lucia": "卢西娅・艾洛温",
  "Evelyn Chevalier": "伊芙琳・舒瓦利耶",
  "Evelyn": "伊芙琳",
  "Burnice White": "柏妮思・怀特",
  "Burnice": "柏妮思",
  "Aria": "爱芮",
  "Sunna": "千夏",
  "Zhao": "照",
  "Yi Xuan": "仪玄",
  "Yixuan": "仪玄",
  
  // Wiki-verified enemy/other names
  "Yum Cha Sin": "饮茶仙",
  "Bringer": "贾斯汀・布林格",
  "Mevorakh": "梅若拉可司教",
  "Creator": "始主",
  "The Defiler": "亵渎者",
  
  // Locations
  "Sixth Street": "六分街",
  "Random Play": "影像店",
  "Lumina Square": "光映广场",
  "Port Elpis": "厄匹斯港",
  "Scott Outpost": "斯科特哨站",
  "Hollow Zero": "零号空洞",
  "Blazewood": "野火镇",
  "Failume Heights": "澄辉坪",
  "Ridu": "新艾利都",
  "Hollows": "空洞",
  "(Hollow)": "",
  // "Hollow" moved after compound entries to avoid substring matching
  
  // NOTE: "Hollows" handled later in terms section (after Commissions fix)
  // Shops (need wiki OL verification)
  "Turbo Remodeling Shop": "涡轮改装店",
  "Convenience Store": "杂货店",
  
  // Terms — only wiki-verified
  "Angels of Delusion": "妄想天使",
  // Removed: combat/Combat→战斗, afternoon→下午 — isolated translations create unreadable mixing
  // Removed (no wiki OL): story scene, login screen, Main Menu, Menu Theme, Ranking Theme,
  //   cutscene, advertisement, mini-games, weekdays, weekends, morning, evening, midnight,
  //   during, Version, featuring, mode, levels, animated, delivering food, comic strip,
  //   selection menu, sections, invincibility
  // KEPT: afternoon (has wiki + OL)
  
  // Songs (wiki-verified from Album page Other Languages)
  "Daybreak": "晓",
  "Rest Awhile": "小停再出发",
  "Wonderland Trickery": "乐园梦游计",
  "Picture Book": "绘本",
  "Self-Cultivation Through Food": "食通万物 修心修身",
  "Turn Heartbeats Into Tempo": "把心跳变成节奏",
  "Shining Promise in the Sky of Dawn": "拂晓之空 闪耀之誓",
  // ReDreaming Angel, Angel Loading, Burning Desires: no wiki Chinese translation
  
  // Events (wiki-verified)
  "Gravitational Attraction": "缘于引力的邂逅",
  "The Port Peak": "波特山",
  "Band of Brave Bangboo": "小邦布勇任防卫军",
  // Compound Commissions forms MUST precede "Commissions" to avoid substring match
  "Cretan Hollow Commissions": "克里特空洞委托",
  "Lemnian Hollow Commissions": "莱姆尼安空洞委托",
  "Ballet Twins Hollow Commissions": "芭莱大厦空洞委托",
  "Commissions": "委托",
  "Commission": "委托",
  "Deadly Interrogation": "致命审讯",
  "Inferno Reap": "刀耕火焚",
  "Virtual Revenge": "虚拟杀机",
  "Lost Void": "迷失之地",
  "Withered Domain": "枯萎之都",
  "Overheated Barrel": "枪管过热",
  "Saving Hacker Rain": "拯救大黑客芮恩",
  "Speedy Chaser": "疾速追机",
  "Emergency Pursuit": "紧急追捕",
  "Small Body Big Crisis": "小身材大危机",
  "Snake Duel": "蛇蛇对决",
  "Ocean Angling": "远海极钓",
  "Sacrifice Core": "牲鬼核心",
  "Waterfall Soup": "锦鲤面馆",
  "Reverb Arena": "热望角",
  "Bardic Needle": "音像店「吟游唱针」",
  "Quality Time": "密友同行",
  "Godfinger": "「金手指」",
  "TOPS": "TOPS",
  "HAND": "HAND",
  "Sān-Z STUDIO": "三Z设计工作室",
  "Old Mining Site": "[空洞]矿区旧址",
  "Stray Paws": "流浪的足迹",
  "Season 2": "第二季",
  "Camellia Golden Week": "沙罗黄金周",
  "Sailume Bay": "泅珑围",
  "Pulchra": "波可娜·费雷尼",
  "Bellum": "巴罗姆",
  "Mors": "莫尔斯",
  "Miasma Priest": "秽息司祭",
  "Twin Marionettes": "冥宁芙・双子",
  "Cheesetopia": "芝托邦餐厅",
  "Provenance of Malice": "【万愆之源】",
  "The Prophecy": "预言之下",
  "Abyssal Enforcer": "暗渊惩戒者",
  "Corrupted Overlord - Pompey": "「霸主侵蚀体・庞培」",
  "Newborn Dead End Butcher": "初生死路屠夫",
  "Unknown Corruption Complex": "未知复合侵蚀体",
  "Drowned Ideal": "溺想者",
  "Miasmic Fiend": "秽息妖鬼·名可名",
  "Terror Raptor": "骇鸟",
  "Wandering Hunter": "彷徨猎手",
  "Sacrifice - Bringer": "牲鬼·布林格",
  "Symbiotic Ethereal Swarm - Code Name: Nineveh": "互利型共生以骸群・代号：尼尼微",
  "Parasitic Ethereal Swarm — Code Name: Geppetto": "偏利型共生以骸群·代号：杰佩托",
  "Primordial Nightmare": "本源性噩梦",
  
  // Story chapter names (must be BEFORE "Hollow" to avoid substring matching)
  "A Call From the Hollow's Heart": "在空洞中心呼唤…?",
  "A Call From the Hollows Heart": "在空洞中心呼唤…?",
  
  // Locations (wiki-verified additions)
  "Timesworn Hills": "[空洞]昔丘",
  "Lumite Mine": "[空洞]辉岭石矿场",
  "Porcelume Processing Base": "[空洞]辉瓷加工基地",
  "Qingming Realm": "[空洞]青溟秘境",
  // Locations (wiki-verified)
  "Melinoe Hollow": "空洞「墨利诺厄」",
  "Lemnian Hollow": "莱姆尼安空洞",
  "Cretan Hollow": "克里特空洞",
  "Outer Ring Hollows": "外环空洞",
  "Ballet Twins Road": "芭莱大厦前",
  "Ballet Twins": "芭莱大厦",
  "New Eridu": "新艾利都",
  "Hollow Investigative Association": "空洞调查协会",
  "Hollow": "空洞",
  // (Hollow) patterns: stripped in import, keep empty to avoid duplication
  
  // Agent Story titles (wiki-verified)
  "Mole in the Hole": "洞中谍",
  "Cat and Mouse Game": "贼猫御鼠",
  "The Iron Witch": "钢铁的女巫",
  "Schoolyard Powerhouse": "满级小学生",
  "And the True Heroes Are Always Behind the Scenes": "而英雄总是归于幕后",
  "Until Your Memory Fades": "直到您彻底遗忘",
  "The Case of a Missing Bangboo": "失踪邦口",
  "A Stroke of Luck": "幸运当头",
  "The Unsung Champion": "无人喝彩之冠",
  
  // Character Demo / MV titles (wiki-verified)
  "In My Name": "以我之名",
  "Leading Man of the Apocalypse": "末日领衔主犯",
  "Martial Summit Showdown": "决战武道之巅",
  "Heroic Roar of the Tiger": "绝世豪虎",
  "Tanukinception": "鬼使狸差",
  "Everlasting Training": "无尽修行",
  "When the Crows Perch": "乌鸦停落之日",
  "Martial Arts Review": "武道审查",
  "Mech Mania": "怦然「芯」动",
  "Wolfishly Charming": "狼质彬彬",
  "Prelude: Mechanical Desire": "序曲：机芯绮愿",
  
  // EP/歌曲来自 miyoushe 官方 — 以官方名称为准
  "Burning Desires": "Burning Desires 绝望吧台",
  "Stars Align": "Stars Align 当群星交汇",
  "FURYON": "FURYON 狂怒觉醒",
  "BITE!": "BITE! 咬合力",
  
  "For My Yixuan": "为了我的仪玄",

  // Character demo titles from miyoushe official
  "Captain Overtime!": "全天候·朱鸢长官!",
  "Captain Overtime": "全天候·朱鸢长官!",
  "Calydon's Ride": "卡吕冬的骑行",
  "99+ To-Dos": "待办事项 99+",
  "Uniform, Scissors, Shark Tail": "制服·剪刀·鲨鱼尾",
  "Youthful Appearance": "青童与白叟",
  "Love Like a Bouquet": "花束般的眷恋",
  "Candidate Zero": "第零适格者",
  "Special Rescue": "特别营救",
  "Achievements Completion Rate... 100%": "成就达成率…100%",
  "Light-Year Phenomenon": "光年效应",
  "Read & Replied Randomly": "已读乱回",
  "Bunny Therapy": "兔兔解忧室",
  "Self-Directed": "自导自演",
  // Fearless, ReDreaming Angel, Tiny Giant, pinKing, DAMIDAMI: miyoushe uses English only
  
  // More songs (wiki-verified from Album pages)
  "Come Alive": "覆灭重生",
  "I Ask": "问",
  "Crimson Pierces the Twilight": "红透晚烟青",
  "Sword and Waltz": "剑与华尔兹",
  "Out of Sight": "目不可及",
  "The Final Song": "最后的歌声",
  "Sometimes You Gotta Get Out & About": "偶尔也要出去逛逛",
  "Last Flight": "最后一次飞行",
  
  // Events / minigames (wiki-verified)
  "Arpeggio Fault": "断层之谜",
  "Hypnosis Recovery Plan": "休眠体回收计划",
  "Rules for Wanderers Lost": "访客安全守则",
  
  // Proper nouns (wiki-verified)
  "A Harmony of Delusions": "妄想协鸣于此刻",
  "Vision Corporation": "远景实业",
  "White Scooter Demon": "白色恶魔",
  "Wonderland Reverie": "乐园游梦记",
  "Thunderbolt Silhouette": "雷霆光影",
  "Undercover R&B": "卧底蓝调",
  "Coffee Mate": "咖啡伴侣",
  "Soul Hounds III": "噬魂犬3",
  "Roaming the Ether": "漫行于以太虚境",
  "The Defector": "「变节者」",
  "Coff Cafe": "COFF CAFE",
  "Notorious Hunt": "恶名狩猎",
  "Dullahan": "杜拉罕",
  "Signal Search": "调频",
  "Devon Pawnshop": "德丰大押",
  "Circuit Reset": "回路重置",
  "Starloop": "星环",
  "Public Security Office": "治安局办事处",
  "Buyan Antique Store": "「不掩」文玩小铺",
  "Dew Gardening Shop": "「朝露」花店",
  "Astra-nomical Moment": "闪耀的此刻",
  "Fallen Mecha Stronghold": "失落的机动要塞",
  "HIA Club": "HIA俱乐部",
  "Suibian Temple": "随便观",
  "Fantasy Resort": "绮梦度假村",
  "Gray Veil Marionette": "冥宁芙・灰纱",
  "Fishing": "垂钓",
  "Flora of the Blooming Valley": "花之谷的芙罗拉",
  "When Dreams Remain Unfinished": "残梦未尽之时",
  "Zero Point Calibration": "归零校准",
  "Gravity Cinema": "引力电影院",
  "Tour de Inferno": "火狱骑行",
  "Neo Golden Mecha": "新黄金魔神战士",
  "Razor": "瑞扎",
  "Threshold Simulation": "临界推演",
  "Into That Pale Wasteland": "直到苍白荒秽之地",
  "Hurcules": "胡威",
  "Mecha Golden Bangboo": "魔神黄金邦布",
  "To Be Fuel for the Night": "微光引灯时",
  "Bangboo vs Ethereal": "「小邦布大战坏以骸」",
  "Symbiotic Ethereal Swarm": "互利型共生以骸群・代号：尼尼微",
  "Parasitic Ethereal Swarm": "偏利型共生以骸群·代号：杰佩托",
  "Nineveh": "尼尼微",
  "Geppetto": "杰佩托",
  "Brant Street Construction Site": "黑雁工地旧址",
  "Encore for an Old Dream": "旧梦的安可曲",
  "Dew Gardening": "「朝露」花店",
  "Endless Tower": "鏖战高塔",
  "Battle Trial: Tidal Wave": "鏖战试炼：狂澜",
  "The Impending Crash of Waves": "将临未抵的深渊",
  "Do Not Go Gentle Into That Good Night": "良夜不可轻逝",
  "Memories of Dreams Bygone": "可曾记得梦",
  "Echoes of Silver": "白银的复苏",
  "Destined to Meet Again": "注定重逢",
  "Where Clouds Embrace the Dawn": "云霞同归处",
  "A Surprise": "一场意外",
  "A Name Written in Water": "此地长眠者",
  "It's Me... Leave A Message": "是我...留言",
  "The Midnight Pursuit": "午夜追捕",
  "Cat's Lost & Found": "猫的失物招领",
  "A Dream Come True": "梦想成真",
  "A Storm of Falling Stars": "星流霆击",
  "Bury Your Tears With the Past": "将眼泪与过往一同埋葬",
  "Bizarre Brigade": "怪奇旅伴",
  "Mach 25": "25马赫",
  "On the Precipice of the Abyss": "将临未抵的深渊",
  "Signal Calibration": "信号校准",
  "To Be Fuel for the Night (QTE sections)": "微光引灯时（QTE段落）",
};

async function main() {
  const client = new Client({
    host: process.env.DB_HOST || "127.0.0.1",
    port: parseInt(process.env.DB_PORT || "15433"),
    user: process.env.DB_USER || "sumicowork",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "hoyomusic",
  });
  await client.connect();

  const res = await client.query(
    `SELECT mn.id, mn.name FROM music_source_nodes mn 
     JOIN music_source_categories mc ON mc.id = mn.category_id 
     WHERE mc.game_id = 3`
  );

  let applied = 0;
  for (const r of res.rows) {
    let text = r.name;
    let changed = false;

    for (const [en, zh] of Object.entries(TRANSLATIONS)) {
      if (text.includes(en)) {
        text = text.split(en).join(zh);
        changed = true;
      }
    }

    if (changed) {
      text = text.replace(/\s{2,}/g, " ").trim();
      
      await client.query("UPDATE music_source_nodes SET name = $1 WHERE id = $2", [text, r.id]);
      applied++;
    }
  }

  // Stats
  const stats = await client.query(
    `SELECT count(*) tot, count(*) FILTER(WHERE mn.name!=mn.en_name) tr
     FROM music_source_nodes mn JOIN music_source_categories mc ON mc.id=mn.category_id WHERE mc.game_id=3`
  );
  console.log(`${applied} nodes updated`);
  console.log(`Translations: ${stats.rows[0].tr}/${stats.rows[0].tot}`);

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
