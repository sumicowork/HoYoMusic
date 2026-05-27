import json
import re
from datetime import datetime, timezone
from pathlib import Path

SRC = Path(r"C:\Users\sumi\WebstormProjects\HoYoMusic\catalog-metadata-export-2026-04-02T11-13-29-821Z.json")


def has_cjk(value: str) -> bool:
    return bool(re.search(r"[\u3400-\u9fff]", value))


def has_latin(value: str) -> bool:
    return bool(re.search(r"[A-Za-z]", value))


def clean(value):
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def split_title(title: str):
    text = title.strip()
    separators = [" / ", " | ", " - ", " -- "]
    for separator in separators:
        if separator in text:
            parts = [part.strip() for part in text.split(separator) if part.strip()]
            if len(parts) == 2:
                first, second = parts
                first_cjk, second_cjk = has_cjk(first), has_cjk(second)
                first_latin, second_latin = has_latin(first), has_latin(second)
                if first_cjk and second_latin and not second_cjk:
                    return first, second, "split_sep_cn_en"
                if second_cjk and first_latin and not first_cjk:
                    return second, first, "split_sep_en_cn"

    parenthesis_match = re.match(r"^(.*?)\s*[\(\[]\s*(.*?)\s*[\)\]]\s*$", text)
    if parenthesis_match:
        first = parenthesis_match.group(1).strip()
        second = parenthesis_match.group(2).strip()
        first_cjk, second_cjk = has_cjk(first), has_cjk(second)
        first_latin, second_latin = has_latin(first), has_latin(second)
        if first_cjk and not first_latin and second_latin and not second_cjk:
            return first, second, "paren_cn_en"
        if second_cjk and not second_latin and first_latin and not first_cjk:
            return second, first, "paren_en_cn"

    # Pattern: CN segment followed by EN segment with plain whitespace separator.
    # We scan from left to right and choose the first valid boundary to avoid
    # accidentally splitting at a trailing suffix like "(Part 2)".
    for match in re.finditer(r"\s+[A-Za-z]", text):
        split_at = match.start() + 1
        left = text[:split_at].strip()
        right = text[split_at:].strip()
        if not left or not right:
            continue
        if has_cjk(left) and not has_latin(left) and has_latin(right) and not has_cjk(right):
            return left, right, "space_cn_en"

    cjk = has_cjk(text)
    latin = has_latin(text)
    if cjk and not latin:
        return text, None, "single_cn"
    if latin and not cjk:
        return None, text, "single_en"
    return None, None, "ambiguous"


def process_rows(rows, summary):
    output_rows = []
    kept_count = 0
    modified_count = 0

    for row in rows:
        uuid = clean(row.get("uuid"))
        if not uuid:
            continue

        title = clean(row.get("title")) or ""
        old_cn = clean(row.get("title_cn"))
        old_en = clean(row.get("title_en"))

        # Historical backfill often copied legacy title into title_cn/title_en.
        # If one side equals title and the other side is empty, treat it as unsplit.
        if old_cn == title and not old_en:
            old_cn = None
        if old_en == title and not old_cn:
            old_en = None

        new_cn = old_cn
        new_en = old_en
        changed = False

        if old_cn and old_en:
            summary["rules"]["existing_bilingual_kept"] += 1
        else:
            candidate_cn, candidate_en, rule = split_title(title)
            summary["rules"][rule] += 1
            if not old_cn and candidate_cn:
                new_cn = candidate_cn[:500]
                changed = True
            if not old_en and candidate_en:
                new_en = candidate_en[:500]
                changed = True

        item = {
            "uuid": uuid,
            "title": title[:500] if title else None,
            "title_cn": new_cn,
            "title_en": new_en,
        }

        if item["title_cn"] is not None or item["title_en"] is not None:
            output_rows.append(item)
            kept_count += 1
            if changed:
                modified_count += 1

    return output_rows, kept_count, modified_count


def main():
    with SRC.open("r", encoding="utf-8") as file:
        source_data = json.load(file)

    albums = source_data.get("albums", []) if isinstance(source_data, dict) else []
    tracks = source_data.get("tracks", []) if isinstance(source_data, dict) else []

    summary = {
        "source": str(SRC),
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "albums_input": len(albums),
        "tracks_input": len(tracks),
        "albums_kept": 0,
        "tracks_kept": 0,
        "albums_modified": 0,
        "tracks_modified": 0,
        "rules": {
            "split_sep_cn_en": 0,
            "split_sep_en_cn": 0,
            "paren_cn_en": 0,
            "paren_en_cn": 0,
            "single_cn": 0,
            "single_en": 0,
                "space_cn_en": 0,
            "ambiguous": 0,
            "existing_bilingual_kept": 0,
        },
    }

    output_albums, albums_kept, albums_modified = process_rows(albums, summary)
    output_tracks, tracks_kept, tracks_modified = process_rows(tracks, summary)

    summary["albums_kept"] = albums_kept
    summary["tracks_kept"] = tracks_kept
    summary["albums_modified"] = albums_modified
    summary["tracks_modified"] = tracks_modified

    payload = {
        "sync_legacy_title": False,
        "albums": output_albums,
        "tracks": output_tracks,
    }

    timestamp = datetime.now().strftime("%Y-%m-%dT%H-%M-%S")
    output_json = SRC.parent / f"catalog-metadata-import-ready-{timestamp}.json"
    output_summary = SRC.parent / f"catalog-metadata-import-ready-{timestamp}.summary.json"

    with output_json.open("w", encoding="utf-8") as file:
        json.dump(payload, file, ensure_ascii=False, indent=2)

    with output_summary.open("w", encoding="utf-8") as file:
        json.dump(summary, file, ensure_ascii=False, indent=2)

    print(str(output_json))
    print(str(output_summary))
    print(json.dumps(summary, ensure_ascii=False))


if __name__ == "__main__":
    main()





