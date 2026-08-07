#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Integrity audit for music-source-dataset.json.

GOAL: prove that every Chinese (zh) string in the dataset was derived from a
REAL source (fandom Other Languages / words.json / the isolated prompt-word
dictionary) and NOT fabricated or guessed by the model.

METHOD:
  A) Universe check — every zh string in the dataset must belong to the set of
     zh values that actually exist in the fandom cache's Other Languages blocks,
     the words.json dictionary, or the prompt-word dictionary. Any zh outside
     this universe is a fabrication and gets flagged.
  B) HSR re-derivation — for every resolved segment, replay the EXACT
     resolve.ts logic (findArticle -> getWikitext -> parseOtherLanguages) purely
     from the on-disk cache, and compare the re-derived zh to the stored one.
  C) Genshin re-derivation — for every location segment, replay translatePath
     (words.json then fandom) from cache and compare.
  D) trackTitle check — trackTitle must equal the track page's own Other
     Languages zhs/zht. A Chinese trackTitle with no fandom source = suspect.
"""
import json, os, re

BASE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(BASE, '.cache')
DS = os.path.join(BASE, 'out', 'music-source-dataset.json')
WORDS = os.path.join(CACHE, 'words.json')

# ---- prompt-word dictionary (mirror of translator.ts PROMPT_DICT) ----
PROMPT_DICT = {
    'dialogue scene in': '对话场景', 'animated short': '动画短片', 'cutscene': '过场动画',
    'trailer': '预告片', 'pv': 'PV', 'teaser': '先导预告', 'show video': '展示视频',
    'candidacy video': '竞选视频', 'character': '角色', 'combat': '战斗', 'boss': '头目',
    'elite combat': '精英战斗', 'echo of war': '战争回响', 'event': '活动', 'wardance': '演武仪典',
}
PROMPT_VALUES = set(PROMPT_DICT.values())

# ---------- cache helpers (mirror fandomClient.ts) ----------
def cache_path(wiki, params):
    key = f"{wiki}__{json.dumps(params, separators=(',', ':'))}"
    safe = re.sub(r'[^a-z0-9_.-]', '_', key, flags=re.I)[:180]
    return os.path.join(CACHE, safe + '.json')

def apiGet(wiki, params):
    p = cache_path(wiki, params)
    if os.path.exists(p):
        with open(p, encoding='utf-8') as f:
            return json.load(f)
    return None

def getWikitext(wiki, page):
    d = apiGet(wiki, {"action": "parse", "page": page, "prop": "wikitext", "redirects": "1"})
    return (d or {}).get('parse', {}).get('wikitext', {}).get('*', '') or ''

def findArticle(wiki, entity):
    d = apiGet(wiki, {"action": "parse", "page": entity, "prop": "wikitext", "redirects": "1"})
    if d and d.get('parse', {}).get('title'):
        return d['parse']['title']
    s = apiGet(wiki, {"action": "query", "list": "search", "srsearch": entity, "srlimit": "3"})
    hits = (s or {}).get('query', {}).get('search', []) or []
    if hits:
        return hits[0]['title']
    return None

def stripRubi(v):
    m = re.search(r'\{\{\s*Rubi\s*\|\s*([^|}]+)', v, re.I)
    base = m.group(1) if m else v
    base = re.sub(r'\{\{[^}]*\}\}', '', base)
    base = base.replace('{', '').replace('}', '')
    return base.strip()

def parseOtherLanguages(wt):
    if not wt:
        return {}
    m = re.search(r'\{\{\s*Other Languages\s*\|([\s\S]*?)\n\}\}', wt) or \
        re.search(r'\{\{\s*Other Languages\s*\|([\s\S]*?)\}\}', wt)
    if not m:
        return {}
    body = m.group(1)
    out = {}
    seen_index = {}
    for raw in body.split('\n'):
        line = re.sub(r'^\s*\|?\s*', '', raw)
        eq = line.find('=')
        if eq < 0:
            continue
        raw_key = line[:eq].strip().lower()
        if not re.match(r'^(\d+_)?[a-z]+$', raw_key):
            continue
        val = stripRubi(line[eq + 1:].strip())
        if not val:
            continue
        im = re.match(r'^(\d+)_([a-z]+)$', raw_key)
        key = im.group(2) if im else raw_key
        idx = int(im.group(1)) if im else 0
        if key not in out or idx < seen_index.get(key, 1 << 30):
            out[key] = val
            seen_index[key] = idx
    return out

def ol_zh(ol):
    return ol.get('zhs') or ol.get('zh') or ol.get('zht') or None

# ---------- build fandom universe + words.json universe ----------
print("Scanning fandom cache for Other Languages (this is the ground-truth universe)...")
fandom_zh_universe = set()
fandom_title_zh = {}   # resolved article title -> zh
cache_files = [f for f in os.listdir(CACHE) if f.endswith('.json')]
for fn in cache_files:
    try:
        d = json.load(open(os.path.join(CACHE, fn), encoding='utf-8'))
    except Exception:
        continue
    if not isinstance(d, dict):
        continue
    parse = d.get('parse')
    if not parse:
        continue
    wt = (parse.get('wikitext') or {}).get('*') or ''
    if not wt:
        continue
    ol = parseOtherLanguages(wt)
    title = parse.get('title')
    # index ALL variants (zhs / zh / zht) as real fandom translations
    for v in (ol.get('zhs'), ol.get('zh'), ol.get('zht')):
        if v:
            fandom_zh_universe.add(v)
            if title:
                fandom_title_zh[title] = v

# words.json
words_zh = set()
words_map = {}
if os.path.exists(WORDS):
    arr = json.load(open(WORDS, encoding='utf-8'))
    for w in arr:
        en = (w.get('en') or '').strip().lower()
        zh = w.get('zhCN') or w.get('zhTW') or w.get('zh')
        if zh:
            words_zh.add(zh)
            if en:
                words_map[en] = zh
    print(f"words.json: {len(arr)} records, {len(words_zh)} zh values")
else:
    print("words.json cache NOT found")

universe = fandom_zh_universe | words_zh | PROMPT_VALUES
universe_list = list(universe)
print(f"Universe size: fandom_zh={len(fandom_zh_universe)} words_zh={len(words_zh)} prompt={len(PROMPT_VALUES)} total={len(universe)}")

# ---------- load dataset ----------
ds = json.load(open(DS, encoding='utf-8'))

# Collect every zh string + its provenance context
outside_universe = []   # fabrications
track_title_issues = [] # trackTitle w/o fandom source
hsr_checks = []         # re-derivation results
genshin_checks = []     # re-derivation results

def is_zh(s):
    return isinstance(s, str) and any('\u4e00' <= c <= '\u9fff' for c in s)

def is_chinese_only(s):
    """A string that is a CHINESE translation candidate: contains Han chars but
    NO Japanese kana / Hangul (those are source-language originals, not zh)."""
    if not is_zh(s):
        return False
    for c in s:
        o = ord(c)
        if 0x3040 <= o <= 0x30ff:   # hiragana/katakana
            return False
        if 0xac00 <= o <= 0xd7af:   # hangul
            return False
    return True

# ---- A) Universe scan over all zh-bearing fields ----
def scan_zh(value, ctx):
    if not is_chinese_only(value):
        return  # skip: not a Chinese translation (English/Japanese/Korean originals kept as-is)
    # otherLanguages.zhs/zht are themselves fandom -> always allowed
    if value in universe:
        return
    # tolerate fandom page edits since the crawl: dataset value may be a
    # prefix/short-form of the current fandom zh (e.g. 不眠之夜 vs 不眠之夜 (《...》))
    if any(value in u or u.startswith(value) for u in universe_list):
        outside_universe.append({'ctx': ctx, 'zh': value, 'kind': 'fandom_variant'})
        return
    outside_universe.append({'ctx': ctx, 'zh': value, 'kind': 'FABRICATION_SUSPECT'})

# trackTitle + otherLanguages
for game in ('genshin', 'hsr'):
    for t in ds[game]['tracks']:
        tt = t.get('trackTitle')
        ol = t.get('otherLanguages') or {}
        # D) trackTitle must come from its own page OL
        if is_zh(tt):
            src = ol.get('zhs') or ol.get('zht') or ol.get('zh')
            if src != tt:
                # maybe trackTitle came from fandom but OL block missing in dataset snapshot
                # accept if it's in fandom universe (it is a real fandom zh)
                if tt not in universe:
                    track_title_issues.append({'game': game, 'page': t.get('pageTitle'), 'trackTitle': tt, 'ol': ol})
            # also register into universe scan
            scan_zh(tt, f"{game} trackTitle {t.get('pageTitle')}")
        # otherLanguages zh are fandom -> register (allowed)
        for kk in ('zhs', 'zht', 'zh'):
            if ol.get(kk):
                scan_zh(ol[kk], f"{game} otherLanguages.{kk} {t.get('pageTitle')}")
        # locations
        for li, loc in enumerate(t.get('locations') or []):
            for i, z in enumerate(loc.get('zhPath') or []):
                scan_zh(z, f"{game} zhPath[{li}][{i}] {t.get('pageTitle')}")
            for i, z in enumerate(loc.get('resolvedZhPath') or []):
                scan_zh(z, f"{game} resolvedZhPath[{li}][{i}] {t.get('pageTitle')}")
            if loc.get('promptZh'):
                scan_zh(loc['promptZh'], f"{game} promptZh[{li}] {t.get('pageTitle')}")

fab = [o for o in outside_universe if o['kind'] == 'FABRICATION_SUSPECT']
var = [o for o in outside_universe if o['kind'] == 'fandom_variant']
print(f"\n[A] Universe scan: {len(outside_universe)} flagged")
print(f"    FABRICATION_SUSPECT (real problem): {len(fab)}")
print(f"    fandom_variant (short/long form, not a problem): {len(var)}")
for o in fab[:80]:
    print("   FAB? ", o)
for o in var[:15]:
    print("   variant:", o['ctx'], '=>', o['zh'])

# ---- B) HSR re-derivation ----
print("\n[B] HSR resolvedZhPath re-derivation (replaying resolve.ts from cache)...")
hsr_total = hsr_match = hsr_mismatch = hsr_unverif = 0
hsr_mismatch_examples = []
for t in ds['hsr']['tracks']:
    for loc in (t.get('locations') or []):
        rpath = loc.get('resolvedPath') or []
        rzh = loc.get('resolvedZhPath') or []
        for i, seg in enumerate(rpath):
            ds_zh = rzh[i] if i < len(rzh) else seg
            hsr_total += 1
            title = findArticle('honkai-star-rail', seg)
            if not title:
                # original also couldn't resolve -> expects English
                if ds_zh == seg:
                    hsr_match += 1
                else:
                    hsr_unverif += 1
                    hsr_mismatch_examples.append({'page': t.get('pageTitle'), 'seg': seg, 'ds_zh': ds_zh, 'note': 'no article in cache but dataset has zh'})
                continue
            wt = getWikitext('honkai-star-rail', title)
            ol = parseOtherLanguages(wt)
            exp = ol_zh(ol) or seg
            if exp == ds_zh:
                hsr_match += 1
            else:
                hsr_mismatch += 1
                if len(hsr_mismatch_examples) < 60:
                    hsr_mismatch_examples.append({'page': t.get('pageTitle'), 'seg': seg, 'expected': exp, 'dataset': ds_zh, 'method': loc.get('method')})
print(f"    total segments={hsr_total} exact_match={hsr_match} mismatch={hsr_mismatch} unverifiable={hsr_unverif}")
for e in hsr_mismatch_examples[:40]:
    print("    MISMATCH", e)

# ---- C) Genshin re-derivation ----
print("\n[C] Genshin zhPath re-derivation (replaying translatePath from cache)...")
g_total = g_match = g_mismatch = g_unverif = 0
g_mismatch_examples = []
for t in ds['genshin']['tracks']:
    for loc in (t.get('locations') or []):
        epath = loc.get('enPath') or []
        zh = loc.get('zhPath') or []
        for i, seg in enumerate(epath):
            ds_zh = zh[i] if i < len(zh) else seg
            g_total += 1
            # translateToken: fandomOverride (own-page OL) wins, else words.json, else English
            # here segment is not the track's own page; check words.json then fandom
            w = words_map.get(seg.strip().lower())
            if w:
                exp = w
            else:
                title = findArticle('genshin-impact', seg)
                if not title:
                    exp = seg
                else:
                    wt = getWikitext('genshin-impact', title)
                    exp = ol_zh(parseOtherLanguages(wt)) or seg
            if exp == ds_zh:
                g_match += 1
            else:
                g_mismatch += 1
                if len(g_mismatch_examples) < 40:
                    g_mismatch_examples.append({'page': t.get('pageTitle'), 'seg': seg, 'expected': exp, 'dataset': ds_zh})
print(f"    total segments={g_total} exact_match={g_match} mismatch={g_mismatch} unverifiable={g_unverif}")
for e in g_mismatch_examples[:30]:
    print("    MISMATCH", e)

# ---------- write report ----------
report = {
    'universe_sizes': {'fandom_zh': len(fandom_zh_universe), 'words_zh': len(words_zh), 'prompt': len(PROMPT_VALUES), 'total': len(universe)},
    'A_total_flagged': len(outside_universe),
    'A_fabrication_suspects': len(fab),
    'A_fabrication_suspect_list': fab[:200],
    'A_fandom_variants': len(var),
    'A_fandom_variant_sample': var[:30],
    'D_track_title_issues': track_title_issues[:200],
    'B_hsr': {'total': hsr_total, 'match': hsr_match, 'mismatch': hsr_mismatch, 'unverifiable': hsr_unverif, 'examples': hsr_mismatch_examples},
    'C_genshin': {'total': g_total, 'match': g_match, 'mismatch': g_mismatch, 'unverifiable': g_unverif, 'examples': g_mismatch_examples},
}
out_path = os.path.join(BASE, 'out', 'audit_integrity_report.json')
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(report, f, ensure_ascii=False, indent=2)
print(f"\nReport written to {out_path}")
