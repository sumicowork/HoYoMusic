#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


IGNORE_DIRS = {"node_modules", "dist", "build", "bin", "obj", ".git", ".idea", ".vs"}
FRONTEND_EXTS = {".ts", ".tsx", ".css"}
DESKTOP_EXTS = {".cs", ".xaml"}


@dataclass
class FileEntry:
    path: Path
    rel: str
    ext: str
    size: int
    mtime: str
    sha1: str


def iter_files(root: Path, allowed_exts: set[str]) -> Iterable[Path]:
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in IGNORE_DIRS]
        for name in filenames:
            p = Path(dirpath) / name
            if p.suffix.lower() in allowed_exts:
                yield p


def file_sha1(path: Path) -> str:
    h = hashlib.sha1()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def build_inventory(root: Path, files: list[Path]) -> list[FileEntry]:
    out: list[FileEntry] = []
    for p in files:
        stat = p.stat()
        out.append(
            FileEntry(
                path=p,
                rel=str(p.relative_to(root)).replace("\\", "/"),
                ext=p.suffix.lower(),
                size=stat.st_size,
                mtime=dt.datetime.fromtimestamp(stat.st_mtime).isoformat(timespec="seconds"),
                sha1=file_sha1(p),
            )
        )
    return out


def safe_read(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return path.read_text(encoding="utf-8", errors="ignore")


def extract_frontend_routes(app_tsx: str) -> list[str]:
    # Match literal routes: path="/..."
    return sorted(set(re.findall(r'path="([^"]+)"', app_tsx)))


def extract_admin_nav_paths(nav_ts: str) -> list[str]:
    return sorted(set(re.findall(r"\{\s*path:\s*'([^']+)'", nav_ts)))


def extract_endpoint_literals(text: str) -> list[str]:
    # Capture quoted path-like literals used in API calls.
    # Supports both '/auth/login' and 'auth/login' forms.
    pattern = r"['\"]([A-Za-z0-9_./:{}?=&\-]+)['\"]"
    raw_values = set(re.findall(pattern, text))
    filtered = []
    for raw in raw_values:
        if "/" not in raw:
            continue
        if raw.startswith("./") or raw.startswith("../"):
            continue
        if raw.startswith("http://") or raw.startswith("https://"):
            continue
        if raw.startswith("//"):
            continue
        if raw.lower() in {"multipart/form-data"}:
            continue
        if any(ch in raw for ch in ("`", ",", " ", "\\", "\t", "\n", "\r")):
            continue
        value = raw if raw.startswith("/") else f"/{raw}"
        if len(value) < 3:
            continue
        filtered.append(value)
    return sorted(filtered)


def detect_category(rel: str) -> str:
    parts = rel.split("/")
    if len(parts) >= 3:
        return parts[2]
    return "root"


def status_rank(status: str) -> int:
    return {"MATCHED": 0, "PARTIAL": 1, "MISSING": 2}.get(status, 3)


def make_evidence(*items: str) -> str:
    uniq = []
    seen = set()
    for item in items:
        if item and item not in seen:
            seen.add(item)
            uniq.append(item)
    return "; ".join(uniq)


def audit_service_file(name: str, desktop_files_by_name: dict[str, str]) -> tuple[str, str]:
    # e.g. tagService.ts -> ITagService.cs + TagService.cs
    stem = name.replace(".ts", "")
    if not stem.endswith("Service"):
        return "PARTIAL", "frontend service naming is non-standard"

    cs_impl = f"{stem[0].upper()}{stem[1:]}.cs"
    iface = f"I{stem[0].upper()}{stem[1:]}.cs"

    has_impl = cs_impl in desktop_files_by_name
    has_iface = iface in desktop_files_by_name

    if has_impl and has_iface:
        return "MATCHED", make_evidence(iface, cs_impl)
    if has_impl or has_iface:
        return "PARTIAL", make_evidence(iface if has_iface else "", cs_impl if has_impl else "")
    return "MISSING", make_evidence(iface, cs_impl)


def audit_page_file(name: str, desktop_xaml: str, desktop_vm: str) -> tuple[str, str]:
    map_tokens = {
        "Home.tsx": ["DiscoverSectionPanel", "discover"],
        "GameDetail.tsx": ["GamesSectionPanel", "games"],
        "PublicLibrary.tsx": ["LibrarySectionPanel", "library"],
        "Library.tsx": ["LibrarySectionPanel", "library"],
        "TrackDetail.tsx": ["TrackDetailStatusMessage", "CurrentDetailTrack"],
        "Albums.tsx": ["AlbumsSectionPanel", "albums"],
        "AlbumDetail.tsx": ["AlbumDetailSectionPanel", "album-detail"],
        "Artists.tsx": ["ArtistsSectionPanel", "artists"],
        "ArtistDetail.tsx": ["ArtistsSectionPanel", "artists"],
        "Tags.tsx": ["TagsSectionPanel", "tags"],
        "TagDetail.tsx": ["TagsSectionPanel", "tags"],
        "Search.tsx": ["SearchSectionPanel", "search"],
        "PlaylistDetail.tsx": ["PlaylistsSectionPanel", "playlists"],
        "Profile.tsx": ["ProfileSectionPanel", "profile"],
        "Settings.tsx": ["SettingsSectionPanel", "settings"],
        "Maintenance.tsx": ["ShowMaintenanceOverlay", "MaintenanceMessage"],
        "Admin.tsx": ["AdminSectionPanel", "OpenAdminSection"],
        "AlbumManagement.tsx": ["IsAdminAlbumsSection", "CreateAdminDiscCommand"],
        "TagManagement.tsx": ["IsAdminTagsSection", "CreateAdminTagCommand"],
        "GameManagement.tsx": ["IsAdminGamesSection", "游戏管理（本轮）"],
        "ArtistManagement.tsx": ["IsAdminArtistsSection", "艺人管理（本轮）"],
        "Analytics.tsx": ["IsAdminAnalyticsSection", "分析概览"],
        "MusicSourceLibraryManagement.tsx": ["IsAdminMusicSourcesSection", "歌词批量导入"],
        "UserManagement.tsx": ["IsAdminUsersSection", "RefreshAdminUsersCommand"],
    }
    tokens = map_tokens.get(name)
    if not tokens:
        return "PARTIAL", "no explicit page mapping rule"

    hits = 0
    evidence: list[str] = []
    for token in tokens:
        if token in desktop_xaml or token in desktop_vm:
            hits += 1
            evidence.append(token)

    if hits == len(tokens):
        return "MATCHED", make_evidence(*evidence)
    if hits > 0:
        return "PARTIAL", make_evidence(*evidence)
    return "MISSING", make_evidence(*tokens)


def audit_component_file(name: str, desktop_all_text: str) -> tuple[str, str]:
    key = name.replace(".tsx", "")
    token_candidates = {
        "Player": ["HoYoPlayerBar", "PlaybackQueueView"],
        "AuthModal": ["账户中心", "LoginCommand"],
        "FirstVisitModal": ["ShowFirstVisitModal", "AcknowledgeFirstVisitCommand"],
        "SiteComplianceFooter": ["ShowComplianceFooter", "OpenComplianceLinkCommand"],
        "FeedbackModal": ["SubmitFeedbackCommand", "AdminFeedbackItems"],
        "EqualizerControl": ["Equalizer", "useEqualizerStore"],
        "CrossfadeControl": ["Crossfade", "crossfade"],
        "SpectrumVisualizer": ["Spectrum", "visualizer"],
        "UploadModal": ["Upload", "上传"],
        "TrackTagsManager": ["BulkUpdate", "Tag"],
        "BulkTagModal": ["bulk", "Tag"],
        "BulkMoveAlbumModal": ["bulk", "Album"],
        "MusicSourceImportModal": ["import preview", "music source"],
    }
    tokens = token_candidates.get(key, [key])
    hits = [t for t in tokens if t.lower() in desktop_all_text.lower()]

    if len(hits) == len(tokens) and len(tokens) > 1:
        return "MATCHED", make_evidence(*hits)
    if hits:
        return "PARTIAL", make_evidence(*hits)
    return "MISSING", make_evidence(*tokens)


def audit_file(
    rel: str,
    desktop_files_by_name: dict[str, str],
    desktop_xaml: str,
    desktop_vm: str,
    desktop_all_text: str,
) -> tuple[str, str, str]:
    name = rel.split("/")[-1]
    category = detect_category(rel)

    if category == "services" and name.endswith("Service.ts"):
        status, evidence = audit_service_file(name, desktop_files_by_name)
    elif category == "pages" and name.endswith(".tsx"):
        status, evidence = audit_page_file(name, desktop_xaml, desktop_vm)
    elif category == "components" and name.endswith(".tsx"):
        status, evidence = audit_component_file(name, desktop_all_text)
    else:
        # For store/theme/utils/css files, we only check textual signal presence.
        base = name.split(".")[0]
        signal = base.lower().replace("store", "").replace("service", "")
        if signal and signal in desktop_all_text.lower():
            status, evidence = "PARTIAL", signal
        else:
            status, evidence = "MISSING", signal or name

    return category, status, evidence


def write_report(
    output_md: Path,
    output_json: Path,
    frontend_inventory: list[FileEntry],
    desktop_inventory: list[FileEntry],
    routes: list[str],
    admin_routes: list[str],
    frontend_endpoints: list[str],
    desktop_endpoints: list[str],
    audit_rows: list[dict],
) -> None:
    now = dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    matched = sum(1 for r in audit_rows if r["status"] == "MATCHED")
    partial = sum(1 for r in audit_rows if r["status"] == "PARTIAL")
    missing = sum(1 for r in audit_rows if r["status"] == "MISSING")

    audit_rows_sorted = sorted(
        audit_rows,
        key=lambda x: (status_rank(x["status"]), x["category"], x["frontend_file"]),
    )

    with output_json.open("w", encoding="utf-8") as f:
        json.dump(
            {
                "generated_at": now,
                "frontend_files": len(frontend_inventory),
                "desktop_files": len(desktop_inventory),
                "routes": routes,
                "admin_routes": admin_routes,
                "frontend_endpoints": frontend_endpoints,
                "desktop_endpoints": desktop_endpoints,
                "rows": audit_rows_sorted,
            },
            f,
            ensure_ascii=False,
            indent=2,
        )

    lines: list[str] = []
    lines.append("# Frontend vs Desktop Code Audit (Code-Only)")
    lines.append("")
    lines.append(f"- Generated at: `{now}`")
    lines.append(f"- Frontend scanned files: `{len(frontend_inventory)}`")
    lines.append(f"- Desktop scanned files: `{len(desktop_inventory)}`")
    lines.append(f"- Route paths found in `frontend/src/App.tsx`: `{len(routes)}`")
    lines.append(f"- Admin nav paths found in `frontend/src/config/adminNavigation.ts`: `{len(admin_routes)}`")
    lines.append("")
    lines.append("## Overall Result")
    lines.append("")
    lines.append(f"- MATCHED: `{matched}`")
    lines.append(f"- PARTIAL: `{partial}`")
    lines.append(f"- MISSING: `{missing}`")
    lines.append("")
    lines.append("Conclusion: **Not fully aligned yet** based on code traversal and heuristic evidence extraction.")
    lines.append("")
    lines.append("## Route Evidence")
    lines.append("")
    lines.append("### Frontend Routes")
    lines.extend([f"- `{r}`" for r in routes])
    lines.append("")
    lines.append("### Frontend Admin Routes")
    lines.extend([f"- `{r}`" for r in admin_routes])
    lines.append("")
    lines.append("## Service Endpoint Evidence")
    lines.append("")
    common = sorted(set(frontend_endpoints) & set(desktop_endpoints))
    only_frontend = sorted(set(frontend_endpoints) - set(desktop_endpoints))
    only_desktop = sorted(set(desktop_endpoints) - set(frontend_endpoints))
    lines.append(f"- Frontend endpoint literals: `{len(frontend_endpoints)}`")
    lines.append(f"- Desktop endpoint literals: `{len(desktop_endpoints)}`")
    lines.append(f"- Common literals: `{len(common)}`")
    lines.append(f"- Frontend-only literals: `{len(only_frontend)}`")
    lines.append(f"- Desktop-only literals: `{len(only_desktop)}`")
    lines.append("")
    lines.append("### Frontend-only Endpoint Samples")
    for item in only_frontend[:40]:
        lines.append(f"- `{item}`")
    lines.append("")
    lines.append("### Desktop-only Endpoint Samples")
    for item in only_desktop[:40]:
        lines.append(f"- `{item}`")
    lines.append("")
    lines.append("## File-by-File Audit")
    lines.append("")
    lines.append("| Frontend File | Category | Status | Evidence |")
    lines.append("|---|---|---|---|")
    for row in audit_rows_sorted:
        lines.append(
            f"| `{row['frontend_file']}` | `{row['category']}` | `{row['status']}` | `{row['evidence']}` |"
        )

    lines.append("")
    lines.append("## Method Notes")
    lines.append("")
    lines.append("- This report is generated from source code traversal, not from previous parity documents.")
    lines.append("- Classification is heuristic for non-service UI files; treat `PARTIAL` as requiring manual confirmation.")
    lines.append(f"- Machine-readable details: `{output_json.as_posix()}`")

    output_md.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Code-only parity audit between frontend and desktop")
    parser.add_argument("--repo", required=True, help="Absolute repo root path")
    parser.add_argument("--md", required=True, help="Output markdown path")
    parser.add_argument("--json", required=True, help="Output json path")
    args = parser.parse_args()

    repo = Path(args.repo).resolve()
    frontend_root = repo / "frontend" / "src"
    desktop_root = repo / "client-desktop" / "src"

    frontend_files = sorted(iter_files(frontend_root, FRONTEND_EXTS))
    desktop_files = sorted(iter_files(desktop_root, DESKTOP_EXTS))

    frontend_inventory = build_inventory(repo, frontend_files)
    desktop_inventory = build_inventory(repo, desktop_files)

    desktop_files_by_name = {p.name: str(p.relative_to(repo)).replace("\\", "/") for p in desktop_files}

    app_tsx = safe_read(frontend_root / "App.tsx")
    admin_nav_ts = safe_read(frontend_root / "config" / "adminNavigation.ts")
    routes = extract_frontend_routes(app_tsx)
    admin_routes = extract_admin_nav_paths(admin_nav_ts)

    frontend_service_text = "\n".join(
        safe_read(p) for p in sorted((frontend_root / "services").glob("*.ts"))
    )
    desktop_service_text = "\n".join(
        safe_read(p)
        for p in sorted((repo / "client-desktop" / "src" / "HoYoMusic.Desktop.Infrastructure" / "Services").glob("*.cs"))
    )
    frontend_endpoints = extract_endpoint_literals(frontend_service_text)
    desktop_endpoints = extract_endpoint_literals(desktop_service_text)

    # Core desktop evidence corpora
    desktop_xaml = safe_read(repo / "client-desktop" / "src" / "HoYoMusic.Desktop.App" / "Controls" / "HoYoMainContent.xaml")
    desktop_vm = "\n".join(
        safe_read(p)
        for p in sorted((repo / "client-desktop" / "src" / "HoYoMusic.Desktop.App" / "ViewModels").glob("MainViewModel*.cs"))
    )
    desktop_all_text = "\n".join(safe_read(p) for p in desktop_files)

    audit_rows: list[dict] = []
    for entry in frontend_inventory:
        category, status, evidence = audit_file(
            entry.rel,
            desktop_files_by_name,
            desktop_xaml,
            desktop_vm,
            desktop_all_text,
        )
        audit_rows.append(
            {
                "frontend_file": entry.rel,
                "category": category,
                "status": status,
                "evidence": evidence,
                "sha1": entry.sha1,
            }
        )

    output_md = Path(args.md).resolve()
    output_json = Path(args.json).resolve()
    output_md.parent.mkdir(parents=True, exist_ok=True)
    output_json.parent.mkdir(parents=True, exist_ok=True)

    write_report(
        output_md=output_md,
        output_json=output_json,
        frontend_inventory=frontend_inventory,
        desktop_inventory=desktop_inventory,
        routes=routes,
        admin_routes=admin_routes,
        frontend_endpoints=frontend_endpoints,
        desktop_endpoints=desktop_endpoints,
        audit_rows=audit_rows,
    )

    print(f"Audit markdown written to: {output_md}")
    print(f"Audit json written to: {output_json}")
    print(f"Scanned frontend files: {len(frontend_inventory)}")
    print(f"Scanned desktop files: {len(desktop_inventory)}")


if __name__ == "__main__":
    main()





