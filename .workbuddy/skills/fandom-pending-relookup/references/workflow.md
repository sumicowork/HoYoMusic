# Re-lookup Workflow — TS Snippets

Copied from the working scripts in `backend/scripts/fandomMusicSource/` (`probe_gi_relookup.ts`, `_gi_fill_verify.ts`, `_gi_proj.ts`). Tune paths/queries to the target game.

## 1. Fandom cache loader + Other Languages parser

```ts
import * as fs from 'fs';
import * as path from 'path';
const CACHE = path.resolve(__dirname, '.cache');
function isSound(t: string, w: string) {
  return /soundtrack/i.test(t) || /{{Soundtrack Infobox/i.test(w);
}
function otherLangZh(wt: string): string {
  const m = wt.match(/{{Other Languages([\s\S]*?)}}/i); if (!m) return '';
  const o: Record<string, string> = {};
  for (const l of m[1].split(/\n/)) {
    const mm = l.match(/^\s*\|?\s*([a-z0-9_]+)\s*=\s*(.+?)\s*$/i);
    if (mm) o[mm[1].toLowerCase().replace(/^\d+_/, '')] = mm[2].replace(/{{[^}]*}}/g, '').trim();
  }
  return o.zhs || o.zht || '';
}
const cacheByTitle = new Map<string, { title: string; wt: string }>();
const zhProviders = new Map<string, { title: string; isSound: boolean }[]>();
for (const f of fs.readdirSync(CACHE).filter((x) => x.endsWith('.json'))) {
  let d: any; try { d = JSON.parse(fs.readFileSync(path.join(CACHE, f), 'utf8')); } catch { continue; }
  const p = d?.parse; if (!p || !p.title) continue;
  const wt = p.wikitext?.['*'] || '';
  cacheByTitle.set(p.title.toLowerCase(), { title: p.title, wt });
  const zh = otherLangZh(wt); if (!zh) continue;
  const arr = zhProviders.get(zh) || [];
  arr.push({ title: p.title, isSound: isSound(p.title, wt) });
  zhProviders.set(zh, arr);
}
```

## 2. Per-node resolve + candidate lookup

```ts
function norm(s: string) { return s.trim().toLowerCase(); }
function candidates(en: string): string[] {
  const raw = en.trim(); const set = new Set<string>([raw]);
  const slash = raw.split('/').pop()!; if (slash && slash !== raw) set.add(slash);
  const pipe = raw.split('|')[0]; if (pipe && pipe !== raw) set.add(pipe);
  return [...set].filter(Boolean);
}
function findCandidate(en: string): { title: string; wt: string } | null {
  for (const c of candidates(en)) {
    const hit = cacheByTitle.get(norm(c));
    if (hit && /{{Other Languages/i.test(hit.wt)) return hit;
  }
  const needle = norm(en); let best: { title: string; wt: string } | null = null;
  for (const v of cacheByTitle.values()) {
    if (!/{{Other Languages/i.test(v.wt)) continue;
    if (norm(v.title).includes(needle) || needle.includes(norm(v.title))) {
      if (isSound(v.title, v.wt)) { if (!best) best = v; } else { best = v; break; }
    }
  }
  return best;
}
```

## 3. Anti-song guard (the core safety check)

```ts
const zh = otherLangZh(cand.wt);
if (!zh) { /* NO_PAGE */ }
const prov = zhProviders.get(zh) || [];
const ns = prov.filter((p) => !p.isSound).length;   // providers that are NOT soundtrack pages
const ss = prov.filter((p) => p.isSound).length;    // providers that ARE soundtrack pages
const isTrackTitle = trackZh.has(zh);                // trackZh = Set of tracks.title_cn
if (ns === 0 || isTrackTitle) { /* REJECT_SONG */ }
else { /* FILL_ZH */ }
```

## 4. Homonym re-check (after the probe)

```ts
// for each FILL_ZH row, recompute:
const prov = zhProviders.get(zh) || [];
const ns = prov.filter((p) => !p.isSound).length;
const ss = prov.filter((p) => p.isSound).length;
if (ns > 0 && ss > 0) { /* AMBIGUOUS → flag, do NOT auto-write */ }
```

## 5. Impact projection (read-only SQL)

```sql
-- edges that would become Chinese after filling the given node ids
SELECT count(*) FROM track_music_sources e WHERE e.node_id = ANY(:fillIds);

-- covered songs with >=1 Chinese location (before / after)
WITH s AS (
  SELECT e.track_id,
         bool_or(n.translation_status='translated' OR n.id = ANY(:fillIds)) h
  FROM track_music_sources e
  JOIN music_source_nodes n ON n.id = e.node_id
  GROUP BY e.track_id
) SELECT count(*) total, count(*) FILTER (WHERE h) with_zh FROM s;
```

## 6. Persist (after approval only)

```sql
CREATE TABLE music_source_nodes_fill_bak_<ts> AS SELECT * FROM music_source_nodes; -- backup
UPDATE music_source_nodes SET name = :zh, translation_status = 'translated'
 WHERE id = :id;  -- en_name left unchanged
```
