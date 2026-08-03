---
name: fandom-pending-relookup
description: Re-lookup untranslated (pending) music_source_nodes from fandom entity pages with strict anti-fabrication guards, then (after user approval + backup + dry-run) idempotently write correct Chinese back. Use when the user asks to "补查待翻译/补查原神/补查星铁/回填 pending" in the HoYoMusic fandomMusicSource pipeline, or when a node-tree translation rate needs lifting without guessing.
agent_created: true
---

# Fandom Pending Translation Re-lookup (HoYoMusic)

Re-derive Chinese for `music_source_nodes` rows where `translation_status='pending'`, using fandom cached entity pages (`{{Other Languages}}`), with **zero fabrication** enforced by two independent guards. Then persist only after explicit user approval, a full-table backup, and a dry-run.

## Hard rules (never violate)
- **Never invent a translation.** A Chinese value is acceptable ONLY if it is found in a fandom entity page's `{{Other Languages}}` block for the resolved entity.
- **Never put model knowledge into data.** If fandom has no value, keep English + `pending`.
- **Never write without: backup + dry-run + user approval.** This is the project's DB-safety iron law.
- **Treating `name==some track's title_cn` as a "match" is a BUG**, not a feature. Locations and theme songs often share names (HoYo naming). The authoritative test for a song-name misplant is: *the Chinese is provided ONLY by a fandom **Soundtrack** page (`{{Soundtrack Infobox}}`)*.

## Pipeline (all read-only until the approve step)

### 1. Load fandom cache + build reverse index
Cache dir: `backend/scripts/fandomMusicSource/.cache/` (one JSON per parsed fandom page, keyed by page title, shape `{ parse: { title, wikitext: { '*': '...' } } }`).
- Build `cacheByTitle: Map<lowercasedTitle, {title, wikitext}>`.
- Extract `{{Other Languages}}` via a line parser: split on `\n`, match `^\s*\|?\s*([a-z0-9_]+)\s*=\s*(.+?)\s*$`, strip a leading `\d+_` index prefix (fandom writes `1_zhs=`, `2_zhs=`), take `zhs` then `zht`, run `stripRubi()` to remove `{{Rubi|..|..}}`.
- Build reverse index `zhProviders: Map<zh, Array<{title, isSound}>>` where `isSound = /soundtrack/i.test(title) || /{{Soundtrack Infobox/i.test(wikitext)`.

### 2. Per pending node: resolve + lookup + guard
For each `pending` node (filter by `game_id`):
- `en = (en_name || name).trim()`.
- Candidates: raw, last segment after `/`, before first `|` (strips `Mission|..|showChapter=0` style wrappers).
- `findCandidate(en)`: exact title match (case-insensitive, requires `{{Other Languages}}` present); else fuzzy (`cache title includes needle OR needle includes cache title`, prefer non-soundtrack).
- Extract `zh = otherLangZh(cand.wikitext)`.
- **Guard A (anti-song):** `prov = zhProviders.get(zh)`; `ns = prov.filter(!isSound).length`; `ss = prov.filter(isSound).length`. Reject if `ns === 0` OR `zh ∈ track title_cn set`.
- **Verdict:** `FILL_ZH` (ns>0, not a track title) / `REJECT_SONG` / `NO_PAGE` (no candidate or no zh).
- Write CSV: `id,en_name,proposed_zh,source_title,verdict`.

### 3. Homonym re-check (mandatory before writing)
Re-scan the FILL_ZH rows: any `zh` with `ns>0 && ss>0` (appears on BOTH a location page and a song page) is ambiguous → flag for manual review, do NOT auto-write. In practice this count is ~0 when Guard A requires `ns>0`, but verify explicitly.

### 4. Impact projection (read-only query)
Join FILL ids against `track_music_sources` to report: how many edges become Chinese, new edge-Chinese coverage %, and how many covered songs gain ≥1 Chinese location. This is what the user actually cares about.

### 5. Persist (ONLY after approval)
- Backup: `CREATE TABLE music_source_nodes_fill_bak_<ts> AS SELECT * FROM music_source_nodes`.
- Dry-run: print exact row count + sample before any write.
- Apply: `UPDATE music_source_nodes SET name=$zh, translation_status='translated' WHERE id=$id` for each FILL id. Leave `en_name` unchanged (keep clean English source). Idempotent.
- Post-write: re-verify 0 orphan edges, 0 category mismatches.

## Key facts about this DB
- `music_source_nodes(game_id, category_id, parent_id, name, en_name, translation_status)`. `name`=Chinese when translated else English; `en_name`=always English source.
- `tracks` has NO game column; game comes via `album_id → albums.game_id`. `title` is mixed CN/EN, `title_en` is pure English.
- `music_source_nodes` translation rate is lopsided by game: HSR ~90%, **Genshin ~27%** (the big pending pile). Combined edge-Chinese coverage is dragged down by Genshin's untranslated nodes.
- `track_music_sources` edges already exist (built earlier); translating a node automatically makes its edges display Chinese (no edge rewrite needed).

## Reference
See `references/workflow.md` for the exact TS snippets (cache loader, `otherLangZh`, guards, projection query) copied from the working `probe_gi_relookup.ts` / `_gi_fill_verify.ts` / `_gi_proj.ts`.
