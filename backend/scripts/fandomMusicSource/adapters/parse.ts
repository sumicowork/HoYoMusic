/** Shared wikitext parsers for fandom infoboxes / templates. */

export function parseInfobox(wt: string, name: string): Record<string, string> {
  // `\b` after the name prevents "Location" from matching "Location Infobox".
  const re = new RegExp(`\\{\\{\\s*${name}\\b\\s*\\|([\\s\\S]*?)\\}\\}`, 'i');
  const m = wt.match(re);
  if (!m) return {};
  const body = m[1];
  const out: Record<string, string> = {};
  // Line-based: each `|key = value` on its own line. Robust against aligned
  // padding (`|region       =`) and empty fields (which we skip entirely so they
  // can't leak garbage into a sibling's value).
  for (const line of body.split('\n')) {
    const fm = line.match(/^\s*\|?\s*([a-zA-Z_]+)\s*=\s*(.*)$/);
    if (!fm) continue;
    const key = fm[1].toLowerCase();
    const val = fm[2].trim();
    if (val) out[key] = val;
  }
  return out;
}

export function parseAllTemplates(wt: string, name: string): string[] {
  const re = new RegExp(`\\{\\{\\s*${name}\\s*\\|([\\s\\S]*?)\\}\\}`, 'gi');
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(wt))) out.push(m[1]);
  return out;
}

/**
 * Normalize a fandom field value: strip wikilink / external-link / italic markup
 * and decode the common HTML entities. fandom `during`/`location` values are
 * messy free text (quest names with [[wikilinks]], trailer [https://...] URLs,
 * &mdash; entities), so we clean before treating them as music-source nodes.
 */
export function cleanWikiText(s: string): string {
  return s
    .replace(/\{\{zh\|([^}]*)\}\}/gi, '$1') // {{zh|王可鑫}} → 王可鑫
    .replace(/\{\{!?\}\}/g, '|') // {{!}} → |
    .replace(/\{\{[^}]*\}\}/g, '') // any leftover template → removed
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1') // [[Target|Display]] / [[Target]]
    .replace(/\[(?:https?:\/\/)[^\s\]]+\s*([^\]]*)\]/g, '$1') // [https://... text]
    .replace(/'''?/g, '') // bold/italic
    .replace(/[\[\]{}]/g, '') // stray markup chars
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&hellip;/g, '…')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Genshin `{{Soundtrack Usage}}` is a MULTI-DIMENSIONAL classification, not just
 * `location`. It carries fields like:
 *   location / quest / domain / eventgameplay / special / special_displayed /
 *   teapot / mediaoriginal
 * each of which is a "where it plays" dimension (maps to music_source_categories:
 * 场景音乐 / 魔神任务 / 秘境 / 活动 / 尘歌壶 ...). A single field may list several
 * values separated by `;;`, and each value uses `//` or `\` for hierarchy.
 * We parse EVERY non-empty dimension so we capture the full picture.
 */
const SOUNDTRACK_USAGE_DIMS = [
  'location',
  'quest',
  'domain',
  'eventgameplay',
  'special',
  'special_displayed',
  'teapot',
  'mediaoriginal',
];

export function parseSoundtrackUsage(wt: string): { dimension: string; values: string[] }[] {
  const bodies = parseAllTemplates(wt, 'Soundtrack Usage');
  const out: { dimension: string; values: string[] }[] = [];
  for (const b of bodies) {
    // Parse field-by-field, one per line: `|location = X` or `location = X`.
    // (The first field may have no leading `|`; values are single-line.)
    for (const line of b.split('\n')) {
      const m = line.match(/^\s*\|?\s*([a-zA-Z_]+)\s*=\s*(.*)$/);
      if (!m) continue;
      const dim = m[1].toLowerCase();
      if (!SOUNDTRACK_USAGE_DIMS.includes(dim)) continue;
      const vals = m[2]
        .split(';;')
        .map((s) => cleanWikiText(s.trim()))
        .filter(Boolean);
      if (!vals.length) continue;
      const existing = out.find((o) => o.dimension === dim);
      if (existing) existing.values.push(...vals);
      else out.push({ dimension: dim, values: vals });
    }
  }
  return out;
}

/** HSR `==Production Credits==` wikitable → [{role, name}]. Loosely parsed; credits are secondary to music-source. */
export function parseCreditsTable(wt: string): { role: string; name: string }[] {
  const sec = wt.match(/==\s*Production Credits\s*==([\s\S]*?)(==\s*\w|$)/);
  if (!sec) return [];
  const tblMatch = sec[1].match(/\{\|[\s\S]*?\|\}/);
  if (!tblMatch) return [];
  const rows = tblMatch[0].split(/\|-/).slice(1);
  const out: { role: string; name: string }[] = [];
  for (const row of rows) {
    const lines = row
      .split('\n')
      .map((l) => l.replace(/^[!|]\s*/, '').trim())
      .filter(Boolean);
    if (lines.length < 2) continue;
    if (/position/i.test(lines[0]) && /staff/i.test(lines.join(' '))) continue;
    const role = lines[0].replace(/!$/, '').trim();
    const name = cleanWikiText(
      lines
        .slice(1)
        .join(' ')
        .replace(/\{\{Reflist\}\}|\{\{ref[^\}]*\}\}/gi, '')
        .replace(/<ref>[\s\S]*?<\/ref>/gi, '')
    );
    if (role && name && !/position|staff/i.test(role)) out.push({ role, name });
  }
  return out;
}
