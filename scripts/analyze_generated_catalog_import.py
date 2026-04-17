import json
import re
import sys
from pathlib import Path

DEFAULT_TARGET = Path(r"C:\Users\sumi\WebstormProjects\HoYoMusic\catalog-metadata-import-ready-2026-04-02T19-20-39.json")


def has_cjk(value: str | None) -> bool:
    return bool(re.search(r"[\u3400-\u9fff]", value or ""))


def has_latin(value: str | None) -> bool:
    return bool(re.search(r"[A-Za-z]", value or ""))


def first_n(rows, n=20):
    return rows[:n]


def main() -> None:
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_TARGET
    payload = json.loads(target.read_text(encoding="utf-8"))
    albums = payload.get("albums", [])
    tracks = payload.get("tracks", [])
    rows = [("album", r) for r in albums] + [("track", r) for r in tracks]

    cn_contains_latin = []
    en_contains_cjk = []
    cn_equals_title = []
    en_too_short = []
    both_missing = []

    for entity_type, row in rows:
        title = row.get("title")
        title_cn = row.get("title_cn")
        title_en = row.get("title_en")

        if title_cn and has_latin(title_cn):
            cn_contains_latin.append((entity_type, row))
        if title_en and has_cjk(title_en):
            en_contains_cjk.append((entity_type, row))
        if title and title_cn and title_cn == title:
            cn_equals_title.append((entity_type, row))
        if title_en and len(title_en.strip()) <= 2:
            en_too_short.append((entity_type, row))
        if not title_cn and not title_en:
            both_missing.append((entity_type, row))

    report = {
        "file": str(target),
        "albums": len(albums),
        "tracks": len(tracks),
        "total": len(rows),
        "issues": {
            "title_cn_contains_latin": len(cn_contains_latin),
            "title_en_contains_cjk": len(en_contains_cjk),
            "title_cn_equals_title": len(cn_equals_title),
            "title_en_very_short": len(en_too_short),
            "both_cn_en_missing": len(both_missing),
        },
        "samples": {
            "title_cn_contains_latin": first_n(cn_contains_latin),
            "title_en_contains_cjk": first_n(en_contains_cjk),
            "title_cn_equals_title": first_n(cn_equals_title),
            "title_en_very_short": first_n(en_too_short),
            "both_cn_en_missing": first_n(both_missing),
        },
    }

    out = target.with_name(target.stem + ".analysis.json")
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(str(out))
    print(json.dumps(report["issues"], ensure_ascii=False))


if __name__ == "__main__":
    main()

