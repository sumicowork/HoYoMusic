# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo Overview

Three apps in one repo, sharing a single PostgreSQL-backed API:

| Layer | Directory | Stack |
|-------|-----------|-------|
| Backend API | `backend/` | Express 5 + TypeScript + PostgreSQL + Passport(JWT) |
| Web frontend | `frontend/` | React 19 + Vite + Ant Design + Zustand + Axios |
| Desktop | `desktop/` | Tauri v2 (Rust shell) + React + TypeScript — a distinct UI from the web client |
| Mobile (early) | `client-mobile/` | Android scaffold (Kotlin + Compose) |

**Rule:** `backend/` API contracts are authoritative — never break them. Desktop and web are independent consumers that must not cross-contaminate each other's code.

**Trust source over docs.** This file (`CLAUDE.md`), `README.md`, and `docs/` prose can drift from reality. When they disagree with the actual source (package.json, `backend/src/*`, `desktop/`, `frontend/src/*`), the **source code is the source of truth**. The old `client-desktop/` (WinUI 3 / .NET) has been removed by another agent — do not treat it as the desktop client; the desktop client is now `desktop/` (Tauri v2).

## Build & Run Commands

### Backend

```powershell
Set-Location backend
npm install
npm run setup        # bootstrap admin user + DB
npm run dev          # nodemon + ts-node on src/index.ts
npm run build        # tsc type-check
```

### Frontend

```powershell
Set-Location frontend
npm install
npm run dev          # Vite dev server
npm run build        # tsc + vite build
```

Convenience scripts at repo root: `start-dev.ps1` / `stop-dev.ps1` are **not present** in this repo (root only has an empty `scripts/` dir) — start each app with `npm run dev` in its own folder.

### Desktop Client (Tauri v2 + React)

```powershell
Set-Location desktop
npm install
npm run dev          # Vite dev server, proxies backend :3000 (root: npm run desktop:dev)
npm run build        # build web assets (root: npm run desktop:build)
npm run tauri        # Tauri CLI: dev/ build/ package the native shell (root: npm run desktop:tauri)
```

The desktop UI under `desktop/` is **independent** from `frontend/` (separate React+TS codebase). It uses Tauri's native integrations (system media transport / SMTC, tray, global shortcuts, offline download) [UNVERIFIED: exact capabilities pending `desktop/` source].

## API Contract (cross-cutting)

Every endpoint returns `{ success: boolean, data?: T, error?: string }`. Frontend `api.ts` parses this shape; the desktop client (`desktop/`) must parse the same envelope. New endpoints must preserve it.

Auth is split into two lanes:
- **Admin APIs:** `Authorization: Bearer <JWT>` (passport-jwt, `authenticateJWT` middleware)
- **Stream/download APIs:** `authenticateStream` middleware (separate token semantics)

Frontend `api.ts` auto-injects `x-visitor-id`, Bearer token, and `Cache-Control: no-cache` for authenticated GETs. Desktop should store its token securely via the OS keystore (Tauri/credential APIs) — never store tokens in plaintext.

## Backend Architecture Notes

- **Startup migrations:** `backend/src/index.ts` runs `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ... IF NOT EXISTS` at boot. There is no separate migration framework. New DB features should add backward-compatible DDL here.
- **Validation:** Zod schemas in `backend/src/validators/schemas.ts`, consumed via `validateBody(schema)` middleware in route files.
- **Storage abstraction:** `backend/src/services/storageService.ts` unifies `local`, `oss`, and `webdav` backends. Initialized at startup based on `STORAGE_MODE` env var.
- **Maintenance mode:** `backend/src/middleware/maintenanceMode.ts` guards all `/api` routes; admin users can be exempted.
- **No backend tests:** `npm test` is a placeholder that exits 1. Validate backend changes with `npm run build` (type-check) instead.

## Desktop Client (Tauri v2) Architecture

Tauri v2 application under `desktop/` (Rust shell + React/TS UI). It is a **distinct UI** from `frontend/` — a separate React+TS codebase with no shared components.

- **Layout:** `desktop/src/` is the React app (`App.tsx`, `router.tsx`, `pages/`, `components/`, `store/`, `lib/`, `generated/` for OpenAPI types); `desktop/src-tauri/` is the Rust shell (`Cargo.toml`, `src/lib.rs`, `src/commands.rs`, `src/main.rs`, `tauri.conf.json`, `capabilities/`).
- **Root scripts:** `npm run desktop:dev` (Vite dev, proxies backend `:3000`), `npm run desktop:build`, `npm run desktop:tauri`.
- **Native integrations** (`desktop/src-tauri/src/commands.rs`, source-verified):
  - Global shortcuts — confirmed via `tauri-plugin-global-shortcut` (`register_shortcut`).
  - System tray show/hide (`show_tray` / `hide_to_tray`) — [UNVERIFIED: actual creation of a tray at runtime not confirmed in this pass].
  - Media transport (SMTC) — **stubbed**: an event channel (`media-metadata`, `media-action`, `global-shortcut`) is wired, but real OS hookup (Windows SMTC / macOS MPRemoteCommandCenter / Linux MPRIS) is not yet implemented [UNVERIFIED].
  - Offline download — a best-effort download command exists [UNVERIFIED: functional scope not verified].
- Consumes the same REST envelope as web/mobile; store tokens via OS keystore, never plaintext.

## Backend Module Map

- **Entry point:** `backend/src/index.ts` — wires security middleware, `/api` maintenance gate, route modules, health/docs endpoints, and startup-time DB migrations.
- **Controllers:** `backend/src/controllers/trackController.ts` handles upload/CRUD; public playback via `backend/src/routes/publicRoutes.ts`.
- **Upload flow:** FLAC magic-byte validation → metadata extraction → optional credits override → storage upload → transactional DB writes.
- **Public playback:** `GET /api/public/tracks/:id/stream` + play-event reporting `POST /api/public/tracks/:id/play`; cover proxy at `/api/public/covers/proxy`.
- **Analytics:** request-level via `backend/src/middleware/visitLogger.ts` (batched inserts to `visit_logs`).
- **Validation:** Zod schemas in `backend/src/validators/schemas.ts` + `validateBody(schema)` middleware in route files.
- **Storage:** `backend/src/services/storageService.ts` unifies `local` / `oss` / `webdav` backends.
- **DB:** Pooled `pg` via `backend/src/config/database.ts`; startup migrations in `backend/src/index.ts` (no migration framework).
- **Admin music-source:** `backend/src/routes/musicSourceRoutes.ts`; tables `music_source_*` and `track_music_sources`.

## Frontend Module Map

- **Entry point:** `frontend/src/App.tsx`; routes lazy-loaded, split between public pages and auth-protected admin pages.
- **API client:** `frontend/src/services/api.ts` centralizes Axios auth, `x-visitor-id`, 401 login-modal recovery, `Cache-Control: no-cache` for authenticated GETs. Feature services import this client.
- **Backend URL:** `VITE_API_URL` env var, falls back to `/api` by default.

## Safe Change Checklist

- **Upload/stream paths:** verify both authenticated (`/api/tracks/...`) and public (`/api/public/...`) routes.
- **Track shape changes:** update admin controller, public routes, and all frontend/desktop consumers that surface the same fields.
- **New DB features:** prefer startup migration style in `backend/src/index.ts` for backward-compatible deploys.
- **No tests exist:** validate backend changes with `npm run build` (type-check), not `npm test`.

## Detailed Docs (read when relevant)

- `README.md` — full project overview with module connection tables
- `docs/specs/CREDITS_IMPORT_SPEC.md` — JSON format for bulk credits import
- `docs/specs/MUSIC_SOURCE_IMPORT_SPEC.md` — structured music source import/export API spec
- `desktop/README.md` — Tauri desktop client setup & scripts (the old `client-desktop/docs/*` are gone with the removed WinUI 3 client)
