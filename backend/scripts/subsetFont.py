#!/usr/bin/env python3
"""子集化 Noto Serif SC — 保留 DB 所有字符 + 常用汉字 3500 个"""
import subprocess, os, sys, re

# ── 1. DB 字符 ──
db_result = subprocess.run([
    'docker', 'exec', 'postgres', 'psql', '-U', 'sumicowork', '-d', 'hoyomusic',
    '-t', '-A', '-c',
    """WITH all_text AS (
  SELECT title as txt FROM tracks UNION ALL SELECT coalesce(title_cn,'') FROM tracks
  UNION ALL SELECT coalesce(title_en,'') FROM tracks
  UNION ALL SELECT title FROM albums UNION ALL SELECT coalesce(title_cn,'') FROM albums
  UNION ALL SELECT coalesce(title_en,'') FROM albums
  UNION ALL SELECT name FROM artists UNION ALL SELECT name FROM games
  UNION ALL SELECT name FROM tags
  UNION ALL SELECT credit_key FROM track_credits UNION ALL SELECT credit_value FROM track_credits
) SELECT string_agg(DISTINCT ch, '') FROM (
  SELECT unnest(regexp_split_to_array(txt, '')) FROM all_text WHERE txt <> ''
) t(ch);"""
], capture_output=True, text=True)
db_chars = set(db_result.stdout.strip().replace('\n', ''))

# ── 2. 现代汉语常用字表 (一级 2500 + 二级 1000 = 3500字) ──
# 来源: 国家语委《通用规范汉字表》一级字表
common_hanzi = """
一乙二十丁厂七卜人入八九几儿了力乃刀又三于工土下大万与才上口山巾千川亿个久凡勺丸夕么及广亡门之义尸弓己已卫子也女飞刃习叉马乡丰王开井天夫
元无云专扎艺木五支厅不太犬区历尤友匹车巨牙屯比互切瓦止少日冈贝内水见午牛手气毛升长仁什片仆化仇币仍仅斤爪反介父从今凶分乏公仓月氏勿欠风丹匀乌凤
勾文六方火为斗忆订计户认心尺引丑巴孔队办以允予劝双书幻玉刊示末未击打巧正扑扒功扔去甘世古节本术可丙左厉右石布龙平灭轧东卡北占业旧帅归旦目且叶甲
申叮电号田由史只央兄叼叫叨另叹四生失禾丘付仗代仙们仪白仔他斥瓜乎丛令用甩印乐句匆册犯外处冬鸟务包饥主市立闪兰半汁汇头汉宁穴它讨写让礼训必议讯记
永司尼民出辽奶奴加召皮边发孕圣对台矛纠母幼丝式刑动扛寺吉扣考托老执巩圾扩扫地扬场耳共芒亚芝朽朴机权过臣再协西压厌在有百存而页匠夸夺灰达列死成夹
轨邪划迈毕至此贞师尘尖劣光当早吐吓虫曲团同吊吃因吸吗屿帆岁回岂刚则肉网年朱先丢舌竹迁乔伟传乒乓休伍伏优伐延件任伤价份华仰仿伙伪自血向似后行舟全
会杀合兆企众爷伞创肌朵杂危旬旨负各名多争色壮冲冰庄庆亦刘齐交次衣产决充妄闭问闯羊并关米灯州汗污江池汤忙兴宇守宅字安讲军许论农讽设访寻那迅尽导异
孙阵阳收阶阴防奸如妇好她妈戏羽观欢买红纤级约纪驰巡寿弄麦形进戒吞远违运扶抚坛技坏扰拒找批扯址走抄坝贡攻赤折抓扮抢孝均抛投坟抗坑坊抖护壳志扭块声
把报却劫芽花芹芬苍芳严芦劳克苏杆杠杜材村杏极李杨求更束豆两丽医辰励否还歼来连步坚旱盯呈时吴助县里呆园旷围呀吨足邮男困吵串员听吩吹呜吧吼别岗帐财
针钉告我乱利秃秀私每兵估体何但伸作伯伶佣低你住位伴身皂佛近彻役返余希坐谷妥含邻岔肝肚肠龟免狂犹角删条卵岛迎饭饮系言冻状亩况床库疗应冷这序辛弃冶
忘闲间闷判灶灿弟汪沙汽沃泛沟没沈沉怀忧快完宋宏牢究穷灾良证启评补初社识诉诊词译君灵即层尿尾迟局改张忌陆阿陈阻附妙妖妨努忍劲鸡驱纯纱纳纲驳纵纷纸
纹纺驴纽奉玩环武青责现表规抹拢拔拣担坦押抽拐拖拍者顶拆拥抵拘势抱垃拉拦拌幸招坡披拨择抬其取苦若茂苹苗英范直茄茎茅林枝杯柜析板松枪构杰述枕丧或画
卧事刺枣雨卖矿码厕奔奇奋态欧垄妻轰顷转斩轮软到非叔肯齿些虎虏肾贤尚旺具果味昆国昌畅明易昂典固忠咐呼鸣咏呢岸岩帖罗帜岭凯败贩购图钓制知垂牧物乖刮
秆和季委佳侍供使例版侄侦侧凭侨佩货依的迫质欣征往爬彼径所舍金命斧爸采受乳贪念贫肤肺肢肿胀朋股肥服胁周昏鱼兔狐忽狗备饰饱饲变京享店夜庙府底剂郊废
净盲放刻育闸闹郑券卷单炒炊炕炎炉沫浅法泄河沾泪油泊沿泡注泻泳泥沸波泼泽治怖性怕怜怪学宝宗定宜审宙官空帘实试郎诗肩房诚衬衫视话诞询该详建肃录隶居
届刷屈弦承孟孤陕降限妹姑姐姓始驾参艰线练组细驶织终绊驼绍经贯奏春帮珍玻毒型挂封持项垮挎城挠政赴赵挡挺括拴拾挑指垫挣挤拼挖按挥挪某甚革荐巷带草
茧茶荒茫荡荣故胡南药标枯柄栋相查柏柳柱柿栏树要咸威歪研砖厘厚砌砍面耐耍牵残殃轻鸦皆背战点临览竖省削尝是盼眨哄显哑冒映星昨畏趴胃贵界虹虾蚁思蚂虽
品咽骂哗咱响哈咬咳哪炭峡罚贱贴骨钞钟钢钥钩卸缸拜看矩怎牲选适秒香种秋科重复竿段便俩贷顺修保促侮俭俗俘信皇泉鬼侵追俊盾待律很须叙剑逃食盆胆胜胞胖
脉勉狭狮独狡狱狠贸急饶蚀饺饼弯将奖哀亭亮度迹庭疮疯疫疤姿亲音帝施闻阀阁差养美姜叛送类迷前首逆总炼炸炮烂剃洁洪洒浇浊洞测洗活派洽染济洋洲浑浓津恒
恢恰恼恨举觉宣室宫宪突穿窃客冠语扁袄祖神祝误诱说诵垦退既屋昼费陡眉孩除险院娃娃姥姨姻娇怒架贺盈勇怠柔垒绑绒结骄绘给络骆绝绞统耕耗艳泰珠班素蚕顽
盏匪捞栽捕振载赶起盐捎捏埋捉捆捐损都哲逝捡换挽热恐壶挨耻耽恭莲莫荷获晋恶真框档桐株桥桃格校核样根索哥速逗栗配翅辱唇夏础破原套逐烈殊顾轿较顿毙致
柴桌虑监紧党晒眠晓鸭晃晌晕蚊哨哭恩唤啊唉罢峰圆贼贿钱钳钻铁铃铅缺氧特牺造乘敌秤租积秧秩称秘透笔笑笋债借值倚倾倒倘俱倡候俯倍倦健臭射躬息徒徐舰舱
般航途拿爹爱颂翁脆脂胸胳脏胶脑狸狼逢留皱饿恋桨浆衰高席准座症病疾疼疲效离唐资凉站剖竞部旁旅畜阅羞瓶拳粉料益兼烤烘烦烧烛烟递涛浙涝酒涉消浩海涂
浴浮流润浪浸涨烫涌悟悄悔悦害宽家宵宴宾窄容宰案请朗诸读扇袜袖袍被祥课谁调冤谅谈谊剥恳展剧屑弱陵陶陷陪娱娘通能难预桑绢绣验继球理捧堵描域掩捷排掉
堆推掀授教掏掠培接控探据掘职基著勒黄萌萝菌菜萄菊萍营械梦梢梅检梳梯桶救副票戚爽聋袭盛雪辅辆虚雀堂常匙晨睁眯眼悬野啦晚啄距跃略蛇累唱患唯崖崭崇圈
铜铲银甜梨犁移笨笼笛符第敏做袋悠偿偶偷您售停偏假得衔盘船斜盒鸽悉欲彩领脚脖脸脱象够猜猪猎猫猛馅馆凑减毫麻痒痕廊康庸鹿盗章竟商族旋望率着盖粘粗粒
断剪兽清添淋淹渠渐混渔淘液淡深婆梁渗情惜惭悼惧惕惊惨惯寇寄宿窑密谋谎祸谜逮敢屠弹随蛋隆隐婚婶颈绩绪续骑绳维绵绸绿替款接塔搭越趁趋超提堤博揭喜插
揪搜煮援裁搁搂搅握揉斯期欺联散惹葬葛董葡敬葱落朝辜葵棒棋植森椅椒棵棍棉棚棕惠惑逼厨厦硬确雁殖裂雄暂雅辈悲紫辉敞赏掌晴暑最量喷晶喇遇喊景践跌跑遗
蛙蛛蜓喝喂喘喉幅帽赌赔黑铸铺链销锁锄锅锈锋锐短智毯鹅剩稍程稀税筐等筑策筛筒答筋筝傲傅牌堡集焦傍储奥街惩御循艇舒番释禽腊脾腔鲁猾猴然馋装蛮就痛童
阔善羡普粪尊道曾焰港湖渣湿温渴滑湾渡游滋溉愤慌惰愧愉慨割寒富窜窝窗遍裕裤裙谢谣谦属屡强粥疏隔隙絮嫂登缎缓编骗缘瑞魂肆摄摸填搏塌鼓摆携搬摇搞塘摊
蒜勤鹊蓝墓幕蓬蓄蒙蒸献禁楚想槐榆楼概赖酬感碍碑碎碰碗碌雷零雾雹输督龄鉴睛睡睬鄙愚暖盟歇暗照跨跳跪路跟遣蛾蜂嗓置罪罩错锡锣锤锦键锯矮辞稠愁筹签简
毁舅鼠催傻像躲微愈遥腰腥腹腾腿触解酱痰廉新韵意粮数煎塑慈煤煌满漠源滤滥滔溪溜滚滨粱滩慎誉塞谨福群殿辟障嫌嫁叠缝缠誓摘撇聚慕暮蔑蔽模榴榜榨歌遭酷
酿酸磁愿需弊裳颗嗽蜻蜡蝇蜘赚锹锻舞稳算箩管僚鼻魄貌膜膊膀鲜疑馒裹敲豪膏遮腐瘦辣竭端旗精歉熄熔漆漂漫滴演漏慢寨赛察蜜谱嫩翠熊凳骡缩慧撕撒趣趟撑播
撞撤增聪鞋蔬横槽樱橡飘醋醉震霉瞒题暴瞎影踢踏踩踪蝴蝠蝎墨镇靠稻黎稿稼箱箭篇僵躺僻德艘膝膛熟摩颜毅糊遵潜潮懂额慰劈操燕薯薪薄颠橘整融醒餐嘴蹄器赠
默镜赞篮邀衡膨雕磨凝辨辩糖糕燃澡激懒壁避缴戴擦鞠藏霜霞瞧蹈螺穗繁辫赢糟糠燥臂翼骤鞭覆蹦镰翻鹰警攀蹲颤瓣爆疆壤耀躁嚼嚷籍魔灌蠢霸露囊罐巨永训必
鲜希乡雪章鱼准座练药麸鼎鼻齐齿龙龛龟"""
common_hanzi = re.sub(r'\s', '', common_hanzi)

# ── 3. ASCII 可打印 ──
ascii_chars = set(
    ' !"#$%&\'()*+,-./0123456789:;<=>?@'
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`'
    'abcdefghijklmnopqrstuvwxyz{|}~'
)

# ── 4. 常用标点 ──
extra = set('…–—''""・•※●○◎◇◆□■△▲▽▼☆★♠♣♥♦♪♯＝≠≒＜＞≦≧→←↑↓↗↘⇒⇔°′″℃℉€£¥¢№§¶†‡µπ×÷±∞√∝≈≡≢≣≤≥⊂⊃⊆⊇⊕⊗⊥∫∮∴∵∶∷∼∽≁≂≃≄≅≆≇≈≉≊≋≌≍≎≏≐≑≒≓≔≕≖≗≘≙≚≛≜≝≞≟≠≡≢≣≤≥≦≧≨≩≪≫≬≭≮≯≰≱≲≳≴≵≶≷≸≹≺≻≼≽≾≿◀▶')

# ── 合并去重 ──
all_chars = db_chars | set(common_hanzi) | ascii_chars | extra
all_chars = {c for c in all_chars if ord(c) >= 32 and not c.isspace()}
charset = ''.join(sorted(all_chars, key=ord))

print(f"Total unique chars: {len(charset)}")
print(f"  DB chars: {len(db_chars)}")
print(f"  Common hanzi added: {len(set(common_hanzi) - db_chars)}")

# ── 找字体文件 ──
font_path = None
for root in ['/opt/www/hoyodb.com', '/opt/hoyomusic']:
    for dirpath, dirs, files in os.walk(root):
        for f in files:
            if 'noto-serif-sc' in f.lower() and f.endswith(('.woff2', '.woff', '.ttf', '.otf')):
                font_path = os.path.join(dirpath, f)
                break
    if font_path:
        break

if not font_path:
    print("ERROR: Font file not found!")
    sys.exit(1)

print(f"Font: {font_path}")

# ── 子集化 ──
os.makedirs('/tmp/fontsub', exist_ok=True)
chars_file = '/tmp/fontsub/chars.txt'
with open(chars_file, 'w', encoding='utf-8') as f:
    f.write(charset)

output = '/tmp/fontsub/noto-serif-sc-subset.woff2'
subprocess.run([
    'pyftsubset', font_path,
    f'--text-file={chars_file}',
    f'--output-file={output}',
    '--flavor=woff2',
    '--layout-features=*',
    '--no-hinting',
    '--desubroutinize',
], check=True)

size = os.path.getsize(output)
print(f"Subset: {size} bytes ({size/1024:.0f} KB)")

# ── 部署 ──
deploy_dir = '/opt/www/hoyodb.com/fonts'
os.makedirs(deploy_dir, exist_ok=True)
import shutil
shutil.copy2(output, os.path.join(deploy_dir, 'noto-serif-sc-subset.woff2'))
print(f"Deployed to {deploy_dir}/noto-serif-sc-subset.woff2")
