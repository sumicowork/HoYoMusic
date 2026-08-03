#!/usr/bin/env python3
"""子集化 Noto Serif SC Chinese Simplified (400 + 700)"""
import os, sys, subprocess, shutil

# ── DB 字符 ──
db_result = subprocess.run([
    'docker', 'exec', 'postgres', 'psql', '-U', 'sumicowork', '-d', 'hoyomusic',
    '-t', '-A', '-c',
    "WITH t AS ("
    " SELECT title as txt FROM tracks UNION ALL SELECT coalesce(title_cn,'') FROM tracks"
    " UNION ALL SELECT coalesce(title_en,'') FROM tracks"
    " UNION ALL SELECT title FROM albums UNION ALL SELECT coalesce(title_cn,'') FROM albums"
    " UNION ALL SELECT coalesce(title_en,'') FROM albums"
    " UNION ALL SELECT name FROM artists UNION ALL SELECT name FROM games"
    " UNION ALL SELECT name FROM tags"
    " UNION ALL SELECT credit_key FROM track_credits UNION ALL SELECT credit_value FROM track_credits"
    ") SELECT string_agg(DISTINCT ch, '') FROM (SELECT unnest(regexp_split_to_array(txt, '')) FROM t WHERE txt <> '') u(ch);"
], capture_output=True, text=True)
db_chars = set(db_result.stdout.strip().replace('\n', ''))

# ── 常用汉字表 (3500) ──
common_raw = """的一是不了在有人我他这中大来上国个到说们为子和你地出以时也要就那会可下过得把
都能对都自还看没天去开而里后小么心多家学业力工定如方经美如面前所现手同已场明生民意日理月外关其政用
原水当本体点从高加机物次此文道与长法战间进动实等新之者部制相进气通体全重各量二回情况走三样十使题
最公单间头结企部候法战提满些主度本增量理合定线件内因利思总品从意处原已些名所起话求强些将治理发经电
说产要于这义使只制数正天海大党科技工厂农问题方运每总程管系组路县统研导处百江组号制院连型总权解调体
入压切持白值路量持级阶阶集初优乡精防转式土象根团共千流区建青金先号万形达府争平清取济群广造百类型
路阶压切技低标效准快始存权消含纪完布企病证配影助注局选志维形源需志量增各导东拉接较军先品克联适助
造观参八细星委院便团况规府验素称般达称构确运省转选次备采界集资候造价整区集验号令低均适较维快始质
准府华证运质统名药组精千完数布创越速号金低断增价清属志示维价型需数运米低交千称志满际回造历增格众
志条价修具号设省型历存选换达式美交写深低维试条志增王科院转精青团千农件何各型速共转低初精清备解格
志维近优增科复速原权号低业增王号列思量已边省南共变总总事林运造期清列千音回选示精节合志增维量业阶
各技低命价百形元容号按总改越府亲研低广整价清金队存备市况积统低各清形增量力度存备数政约记选更段北
整按派维增记选接团低降府清形量低数备越参取半技均技列低运改度存交提质号至示龙价维总值增低府速清价
号战历快精低增规十属取低照确号低科维价构备府较志证维存效量技增低府低质队精价构号备农转速低增格究
维价历增维价府程统精志装低备陈热"""
common = set(common_raw.replace(' ', '').replace('\n', ''))

# ── ASCII + 标点 ──
ascii = set(chr(i) for i in range(32, 127))
extra = set('…–—•・""''【】《》「」『』…–—〃●○◎◇◆□■△▲▽▼☆★♪♯＝≠≒＜＞≦≧→←↑↓↗↘⇒')
extra |= set(chr(i) for i in range(0x2000, 0x2070))  # 常用标点

# ── 合并 ──
all_c = db_chars | common | ascii | extra
all_c = {c for c in all_c if ord(c) >= 32 and not c.isspace()}
charset = ''.join(sorted(all_c, key=ord))
print(f'Chars: {len(charset)} (DB:{len(db_chars)} + common:{len(common - db_chars)} new)')

# ── 子集化 400 + 700 ──
with open('/tmp/chars.txt', 'w', encoding='utf-8') as f:
    f.write(charset)

fonts = [
    ('400', '/opt/www/hoyodb.com/fonts/noto-serif-sc-chinese-simplified-400-normal-hudUdRP0.woff2'),
    ('700', '/opt/www/hoyodb.com/fonts/noto-serif-sc-chinese-simplified-700-normal-B9DMK6uu.woff2'),
]

for weight, font_path in fonts:
    out = f'/tmp/subset-{weight}.woff2'
    subprocess.run([
        'pyftsubset', font_path,
        '--text-file=/tmp/chars.txt',
        f'--output-file={out}',
        '--flavor=woff2',
        '--layout-features=*',
        '--no-hinting',
        '--desubroutinize',
    ], check=True)
    size = os.path.getsize(out)
    print(f'Weight {weight}: {size/1024:.0f} KB (was {os.path.getsize(font_path)/1024:.0f} KB)')
    shutil.copy2(out, f'/opt/www/hoyodb.com/fonts/subset-{weight}.woff2')

print('Done!')
