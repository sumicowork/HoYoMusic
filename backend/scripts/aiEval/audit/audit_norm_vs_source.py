# -*- coding: utf-8 -*-
"""归一化细节审计 v2：片段级对比
在源行中定位 value 的精确片段（token 顺序匹配），只检查该片段的：
A. 括号被删（片段后紧跟 (xxx) 而 value 无）
B. @ 被删（片段内含 @ 而 value 无）
C. 空格被删（片段内 token 间有空格而 value 无）
D. 全角被改（片段内全角字符在 value 中变半角）
"""
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

def all_content_lines(text):
    out = []
    for l in text.splitlines():
        s = l.strip()
        if re.match(r'^\[(ti|ar|al|by|offset|length|re|ve|total|language):', s, re.I): continue
        m = re.match(r'^\[\d{1,2}:\d{2}(?:[.:]\d{1,3})?\](.*)$', s)
        content = m.group(1).strip() if m else s
        if content: out.append(content)
    return out

def find_span(src_line, value):
    """在源行定位 value 的原始片段。value 按空白拆 token，源行 token 顺序匹配。
    返回 (片段原始文本, 片段结束位置) 或 None"""
    v_tokens = value.split()
    if not v_tokens:
        return None
    s_tokens = src_line.split()
    v_norm = [norm(t) for t in v_tokens]
    s_norm = [norm(t) for t in s_tokens]
    n = len(v_norm)
    for i in range(len(s_norm) - n + 1):
        if s_norm[i:i + n] == v_norm:
            start = sum(len(t) + 1 for t in s_tokens[:i])  # 粗略起点（空格+1）
            end = start + len(' '.join(s_tokens[i:i + n]))
            return ' '.join(s_tokens[i:i + n]), end
    return None

FULLW = '（）２３４５６７８９０１２ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ！？：；，。・　'
A_paren, B_at, C_space, D_fw = [], [], [], []
for tid, db_rows in by_track.items():
    rel = manifest.get(tid)
    src_text = find_src_lrc(rel)
    if not src_text: continue
    src_lines = all_content_lines(src_text)
    for key, value in db_rows:
        if len(value) < 2: continue
        found = False
        for src_line in src_lines:
            span = find_span(src_line, value)
            if not span: continue
            found = True
            frag, end = span
            rest = src_line[end:]
            # A. 片段结束后紧跟括号（源有厂牌括号）而 value 无
            if re.match(r'^\s*[（(]', rest) and '(' not in value and '（' not in value:
                A_paren.append((tid, key, value, frag, rest[:25]))
            # B. 片段内含 @ 而 value 无
            if '@' in frag and '@' not in value:
                B_at.append((tid, key, value, frag))
            # C. 片段内 token 间有空格而 value 无空格（value 多 token 才可比）
            if len(value.split()) >= 2 and ' ' not in value:
                C_space.append((tid, key, value, frag))
            # D. 片段含全角而 value 对应处半角（全角字符在片段中但 value 中无该全角）
            for ch in frag:
                if ch in FULLW and ch not in value:
                    D_fw.append((tid, key, value, frag, ch))
                    break
            break
        # 找不到片段的行跳过（编造已由前轮覆盖）

print('=' * 60)
print('归一化细节审计 v2（片段级）')
print(f'❌ A 厂牌括号被删: {len(A_paren)}')
print(f'❌ B @ 被删: {len(B_at)}')
print(f'⚠️ C 空格被删: {len(C_space)}')
print(f'⚠️ D 全角被改: {len(D_fw)}')
print('=' * 60)
for name, lst in [('A 括号', A_paren), ('B @', B_at), ('C 空格', C_space), ('D 全角', D_fw)]:
    if lst:
        print(f'\n=== {name}（前 25 / {len(lst)}）===')
        for item in lst[:25]:
            if name == 'A 括号':
                tid, k, v, frag, rest = item
                print(f'  #{tid} [{k}] {v[:35]}  ←片段[{frag[:30]}] 后跟{rest}')
            elif name == 'B @':
                tid, k, v, frag = item
                print(f'  #{tid} [{k}] {v[:35]}  ←片段[{frag[:40]}]')
            elif name == 'C 空格':
                tid, k, v, frag = item
                print(f'  #{tid} [{k}] {v[:35]}  ←片段[{frag[:40]}]')
            else:
                tid, k, v, frag, ch = item
                print(f'  #{tid} [{k}] {v[:35]}  ←片段[{frag[:35]}] 全角{ch}')
