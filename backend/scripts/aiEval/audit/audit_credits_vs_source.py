# -*- coding: utf-8 -*-
"""创作者审计 v2：修复无时间戳 credit 行解析 + 出品行视为设计排除"""
import json, re, os, unicodedata

credits = json.load(open(r'C:/Users/sumi/AppData/Local/Temp/audit_credits.json', encoding='utf-8'))
by_track = {}
for c in credits:
    by_track.setdefault(c['track_id'], []).append((c['key'], c['value']))

manifest = {}
for line in open(r'C:/Users/sumi/AppData/Local/Temp/upload_manifest_clean.tsv', encoding='utf-8').read().splitlines():
    tid, rel = line.split('\t')
    manifest[int(tid)] = rel

ROOT = r'D:/CreditDebug/QQ音乐下载'

def norm(s):
    if not s: return ''
    s = unicodedata.normalize('NFKC', s).lower()
    return re.sub(r'[\s_\-—·.,"\'!?！？。，、…()（）【】\[\]]+', '', s)

def find_src_lrc(rel):
    p = os.path.join(ROOT, rel.replace('/', os.sep))
    if os.path.exists(p):
        raw = open(p, 'rb').read()
        try: return raw.decode('utf-8')
        except UnicodeDecodeError: return raw.decode('gbk', errors='replace')
    return None

def credit_lines(text):
    """credit 行：含冒号的内容行（有/无时间戳都算），排除元数据头"""
    out = []
    for l in text.splitlines():
        s = l.strip()
        if re.match(r'^\[(ti|ar|al|by|offset|length|re|ve|total|language):', s, re.I):
            continue  # 元数据头
        m = re.match(r'^\[\d{1,2}:\d{2}(?:[.:]\d{1,3})?\](.*)$', s)
        content = m.group(1).strip() if m else s
        if content and ('：' in content or ':' in content):
            out.append(content)
    return out

A_fab, B_role, D_miss, D_pub = [], [], [], []
checked = 0
for tid, db_rows in by_track.items():
    rel = manifest.get(tid)
    src_text = find_src_lrc(rel)
    if not src_text:
        continue
    checked += 1
    src_credits = credit_lines(src_text)
    src_credits_norm = [norm(c) for c in src_credits]

    for key, value in db_rows:
        vn, kn = norm(value), norm(key)
        if '出品' in kn or 'musicby' in kn or 'publish' in kn:
            continue  # 铁律：不应存在（前面单独统计）
        if len(vn) >= 2 and not any(vn in cn for cn in src_credits_norm):
            A_fab.append((tid, key, value))
        if len(kn) >= 2 and not any(kn in cn for cn in src_credits_norm):
            B_role.append((tid, key, value))

    db_vals = [norm(v) for _, v in db_rows]
    for c, cn in zip(src_credits, src_credits_norm):
        # 出品行：设计上不提取，单独计数
        if '出品' in cn or 'musicby' in cn:
            D_pub.append((tid, c))
            continue
        parts = re.split(r'[、，,/／]', c)
        hit = False
        for p in parts:
            pn = norm(p)
            if not pn or len(pn) < 2: continue
            if any(vn and (vn in pn or pn in vn) for vn in db_vals):
                hit = True
                break
        if not hit:
            D_miss.append((tid, c))

print('=' * 60)
print(f'审计: {checked} 首 / {len(credits)} 条 credits')
print(f'❌ A 编造 name: {len(A_fab)} 条')
print(f'⚠️ B role 异常: {len(B_role)} 条')
print(f'⚠️ D 真实遗漏粗筛: {len(D_miss)} 条')
print(f'ℹ️ 出品行（设计不提取）: {len(D_pub)} 条')
print('=' * 60)

if A_fab:
    print('\n=== A 编造候选 ===')
    for tid, k, v in A_fab[:40]:
        print(f'  #{tid} [{k}] {v[:50]}')
if B_role:
    print('\n=== B role 异常候选 ===')
    for tid, k, v in B_role[:30]:
        print(f'  #{tid} [{k}] {v[:40]}')
if D_miss:
    print(f'\n=== D 遗漏粗筛（前 30 / {len(D_miss)}）===')
    for tid, c in D_miss[:30]:
        print(f'  #{tid} | {c[:60]}')
print()
