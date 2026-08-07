# -*- coding: utf-8 -*-
"""全量完整性审计：lyrics_text vs 源 LRC 逐行比对（确定性规则，不依赖 AI）

检查三项：
A. 编造行：lyrics_text 中的行（时间戳+内容）在源 LRC 中不存在 → AI 编造/篡改
B. 时间戳篡改：同内容但时间戳不同（±0.5s 容差）
C. 疑似误删：源 LRC 中"不含冒号的非元数据行"（粗判歌词行）不在 lyrics_text
   ——credit 行通常含冒号，歌词行通常不含；此为粗筛，误删清单需人工复核
"""
import json, re, os, unicodedata

# ── 数据加载 ──
tracks = json.load(open(r'C:/Users/sumi/AppData/Local/Temp/audit_has.json', encoding='utf-8'))
by_id = {t['id']: t for t in tracks}

# manifest 映射（track_id -> 源 LRC 相对路径）
manifest = {}
for line in open(r'C:/Users/sumi/AppData/Local/Temp/upload_manifest_clean.tsv', encoding='utf-8').read().splitlines():
    tid, rel = line.split('\t')
    manifest[int(tid)] = rel

ROOT = r'D:/CreditDebug/QQ音乐下载'

def norm(s):
    if not s:
        return ''
    s = unicodedata.normalize('NFKC', s).lower()
    return re.sub(r'[\s_\-—·.,"\'!?！？。，、…()（）【】\[\]]+', '', s)

def parse_lrc(text):
    """解析 LRC：返回 [(ts_sec, content), ...]"""
    out = []
    for l in text.splitlines():
        m = re.match(r'^\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\](.*)$', l.strip())
        if m:
            mm, ss, frac = int(m.group(1)), int(m.group(2)), m.group(3)
            ts = mm * 60 + ss + (int(frac.ljust(3, '0')) / 1000 if frac else 0)
            out.append((ts, m.group(4).strip()))
    return out

def find_src_lrc(rel):
    p = os.path.join(ROOT, rel.replace('/', os.sep))
    if os.path.exists(p):
        raw = open(p, 'rb').read()
        try:
            return raw.decode('utf-8')
        except UnicodeDecodeError:
            return raw.decode('gbk', errors='replace')
    return None

# ── 审计 ──
A_fabricated = []      # 编造/篡改行
B_ts_diff = []         # 时间戳差异
C_missing = []         # 疑似误删（粗筛）
ok_count = 0
no_lrc = []

for t in tracks:
    tid, title, lt = t['id'], t['title'], t['lyrics_text'] or ''
    rel = manifest.get(tid)
    src_text = find_src_lrc(rel) if rel else None
    if src_text is None:
        no_lrc.append((tid, title, rel))
        continue

    src_lines = parse_lrc(src_text)
    src_by_content = {}
    for ts, content in src_lines:
        if content:
            src_by_content.setdefault(norm(content), []).append(ts)

    db_lines = parse_lrc(lt)
    fabricated = []
    ts_diff = []
    for ts, content in db_lines:
        if not content:
            continue
        hits = src_by_content.get(norm(content), [])
        if not hits:
            fabricated.append((ts, content))
        elif not any(abs(h - ts) <= 0.5 for h in hits):
            ts_diff.append((ts, content, hits[0]))

    # 疑似误删：源 LRC 中不含冒号的非空行（粗判歌词）不在 DB
    db_norm = {norm(c) for _, c in db_lines if c}
    missing = []
    for ts, content in src_lines:
        if not content or '：' in content or ':' in content:
            continue  # 含冒号 → 大概率 credit/念白标记行，跳过
        if norm(content) not in db_norm:
            missing.append((ts, content))

    if fabricated or ts_diff or missing:
        if fabricated:
            A_fabricated.append((tid, title, fabricated[:5]))
        if ts_diff:
            B_ts_diff.append((tid, title, ts_diff[:5]))
        if missing:
            C_missing.append((tid, title, missing[:8], len(missing)))
    else:
        ok_count += 1

print('=' * 60)
print(f'审计范围: has track {len(tracks)} 首')
print(f'✅ 完全一致（无编造/无时间戳异常/无缺失）: {ok_count}')
print(f'❌ A 编造/篡改行: {len(A_fabricated)} 首')
print(f'⚠️ B 时间戳差异: {len(B_ts_diff)} 首')
print(f'⚠️ C 疑似漏行: {len(C_missing)} 首')
print(f'⚠️ 源 LRC 找不到: {len(no_lrc)} 首')
print('=' * 60)

if A_fabricated:
    print('\n=== A 编造/篡改行（最严重）===')
    for tid, title, rows in A_fabricated:
        print(f'#{tid} {title[:40]}:')
        for ts, c in rows:
            print(f'   [{ts:.2f}] {c[:60]}')

if B_ts_diff:
    print('\n=== B 时间戳差异 ===')
    for tid, title, rows in B_ts_diff:
        print(f'#{tid} {title[:40]}:')
        for ts, c, src in rows:
            print(f'   DB[{ts:.2f}] vs 源[{src:.2f}] {c[:50]}')

if C_missing:
    print('\n=== C 疑似漏行（粗筛，需复核）===')
    for tid, title, rows, total in C_missing:
        print(f'#{tid} {title[:40]} ({total} 行):')
        for ts, c in rows:
            print(f'   [{ts:.2f}] {c[:60]}')

if no_lrc:
    print('\n=== 源 LRC 缺失 ===')
    for tid, title, rel in no_lrc:
        print(f'#{tid} {title[:40]} | {rel}')

print('\n审计完成')
