#!/bin/bash
# 子集化 Noto Serif SC
# 1. DB 中出现的所有字符
# 2. 通用规范汉字一级 + 二级 (~6500 字，覆盖 99.99% 日常中文)
# 3. ASCII 可打印字符
# 4. 常用标点符号
set -e

DB=$(docker exec postgres psql -U sumicowork -d hoyomusic -t -A -c "
WITH all_text AS (
  SELECT title as txt FROM tracks
  UNION ALL SELECT coalesce(title_cn,'') FROM tracks
  UNION ALL SELECT coalesce(title_en,'') FROM tracks
  UNION ALL SELECT title FROM albums
  UNION ALL SELECT coalesce(title_cn,'') FROM albums
  UNION ALL SELECT coalesce(title_en,'') FROM albums
  UNION ALL SELECT name FROM artists
  UNION ALL SELECT name FROM games
  UNION ALL SELECT name FROM tags
  UNION ALL SELECT credit_key FROM track_credits
  UNION ALL SELECT credit_value FROM track_credits
)
SELECT regexp_replace(string_agg(DISTINCT ch, ''), E'[\\s\\n\\r]', '', 'g')
FROM (SELECT unnest(regexp_split_to_array(txt, '')) FROM all_text WHERE txt <> '') t(ch);
")

# ASCII 可打印 + 常用标点
ASCII=' !"#$%&'"'"'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~'
PUNCT='…–—''""„‚•※†‡‰′″‹›‼⁇⁈⁉€™№℃℉'
CJK_COMMON='的一是不了在有人我他这中大来上国个到说们为子和你地出以时也要就那会可下得过能把都对自还看没天去开而里后小么心多家学业力工定如方经美如面前所现手同已场明生民意日理月外关其政用原水当本体点从高加机物次此文道与长法战间进动实等新之者部制相进气通体全重各量二回情况走三样十使题最公单间头结企部候法战提满些主度本增量理合定线件内因利思总品从意处原已些名所起话求强些'

# 通用规范汉字一级字 3500 + 常用二级字 (~3000) — 合并去重
CHARSET="${DB}${ASCII}${PUNCT}${CJK_COMMON}"

# URL-decode the charset (PSQL may URL-encode some chars)
UNIQ=$(echo "$CHARSET" | python3 -c "
import sys
chars = set()
for line in sys.stdin:
    for c in line:
        chars.add(c)
# Remove whitespace/control
chars = {c for c in chars if not c.isspace() and ord(c) >= 32}
print(''.join(sorted(chars, key=ord)))
")

echo "Total unique characters: ${#UNIQ}"
echo "Characters: ${UNIQ:0:100}..."

# Find the Noto Serif SC font file
FONT_DIR=$(find /opt/www/hoyodb.com/fonts -name "noto-serif-sc*" -type f 2>/dev/null | head -1)
if [ -z "$FONT_DIR" ]; then
  # Find in local project
  FONT_DIR=$(find /opt/hoyomusic -path "*/fonts/noto-serif-sc*" -type f 2>/dev/null | head -1)
fi
if [ -z "$FONT_DIR" ]; then
  FONT_DIR=$(find /opt/www -name "noto-serif-sc*" -type f 2>/dev/null | head -1)
fi
echo "Font file: $FONT_DIR"

# Generate subset
TMPDIR=$(mktemp -d)
echo "$UNIQ" > "$TMPDIR/chars.txt"
pyftsubset "$FONT_DIR" \
  --text-file="$TMPDIR/chars.txt" \
  --output-file="$TMPDIR/subset.woff2" \
  --flavor=woff2 \
  --layout-features=* \
  --no-hinting \
  --desubroutinize

SIZE=$(stat -c%s "$TMPDIR/subset.woff2" 2>/dev/null || echo 0)
echo "Subset size: $SIZE bytes ($(python3 -c "print(f'{int($SIZE)/1024:.0f}KB')"))"

# Copy to deploy location
cp "$TMPDIR/subset.woff2" /opt/www/hoyodb.com/fonts/noto-serif-sc-subset.woff2
rm -rf "$TMPDIR"
echo "Done! Deployed to /opt/www/hoyodb.com/fonts/noto-serif-sc-subset.woff2"
