# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo Overview

Three apps in one repo, sharing a single PostgreSQL-backed API:

| Layer | Directory | Stack |
|-------|-----------|-------|
| Backend API | `backend/` | Express 5 + TypeScript + PostgreSQL + Passport(JWT) |
| Web frontend | `frontend/` | React 19 + Vite + Ant Design + Zustand + Axios |
| Windows desktop | `client-desktop/` | .NET 8 + WinUI 3 + CommunityToolkit.Mvvm + MSIX |
| Mobile (early) | `client-mobile/` | Android scaffold |

**Rule:** `backend/` API contracts are authoritative — never break them. Desktop and web are independent consumers that must not cross-contaminate each other's code.

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

Convenience scripts at repo root: `start-dev.ps1` (both apps), `stop-dev.ps1`.

### Windows Desktop Client

```powershell
Set-Location client-desktop
dotnet restore HoYoMusic.Desktop.sln
dotnet build HoYoMusic.Desktop.sln -c Debug -p:Platform=$env:PROCESSOR_ARCHITECTURE
dotnet run --project src\HoYoMusic.Desktop.App\HoYoMusic.Desktop.App.csproj
dotnet test HoYoMusic.Desktop.sln -c Debug --no-build -p:Platform=$env:PROCESSOR_ARCHITECTURE
```

The desktop app is MSIX-packaged. For full sideload registration and smoke-test scripts, see `client-desktop/docs/README.md` and `client-desktop/scripts/startup-smoke.ps1`.

## API Contract (cross-cutting)

Every endpoint returns `{ success: boolean, data?: T, error?: string }`. Desktop `ApiEnvelope<T>` in `client-desktop/src/HoYoMusic.Desktop.Core/Contracts/ApiEnvelope.cs` and frontend `api.ts` both parse this shape. New endpoints must preserve it.

Auth is split into two lanes:
- **Admin APIs:** `Authorization: Bearer <JWT>` (passport-jwt, `authenticateJWT` middleware)
- **Stream/download APIs:** `authenticateStream` middleware (separate token semantics)

Frontend `api.ts` auto-injects `x-visitor-id`, Bearer token, and `Cache-Control: no-cache` for authenticated GETs. Desktop `AuthService` uses `WindowsCredentialTokenStore` (Windows PasswordVault) — never store tokens in plaintext.

## Backend Architecture Notes

- **Startup migrations:** `backend/src/index.ts` runs `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ... IF NOT EXISTS` at boot. There is no separate migration framework. New DB features should add backward-compatible DDL here.
- **Validation:** Zod schemas in `backend/src/validators/schemas.ts`, consumed via `validateBody(schema)` middleware in route files.
- **Storage abstraction:** `backend/src/services/storageService.ts` unifies `local`, `oss`, and `webdav` backends. Initialized at startup based on `STORAGE_MODE` env var.
- **Maintenance mode:** `backend/src/middleware/maintenanceMode.ts` guards all `/api` routes; admin users can be exempted.
- **No backend tests:** `npm test` is a placeholder that exits 1. Validate backend changes with `npm run build` (type-check) instead.

## Desktop Client (WinUI 3) Architecture

Four-project solution under `client-desktop/`:

- **HoYoMusic.Desktop.App** — WinUI 3 UI layer. `MainWindow` with sidebar navigation, content area (`HoYoMainContent`), and player bar (`HoYoPlayerBar`). ViewModels in `ViewModels/MainViewModel.*.cs` (split across partial class files by feature domain: Navigation, Discover, Library, Player, Admin, Settings, etc.).
- **HoYoMusic.Desktop.Core** — Interfaces (`Core/Abstractions/I*Service.cs`), DTOs (`Core/Models/`), and contracts (`ApiEnvelope`, `ApiException`). No external dependencies except .NET.
- **HoYoMusic.Desktop.Infrastructure** — HTTP service implementations + credential storage. `ServiceCollectionExtensions.AddHoYoMusicInfrastructure()` wires all services via `IHttpClientFactory`. `ApiConstants.ResolveBaseUri()` reads `HOYOMUSIC_API_BASE_URL` env var, falls back to `https://music.hoyodb.com/api/`.
- **HoYoMusic.Desktop.Tests** — xUnit tests covering service behaviors, queue rules, API envelope parsing, and play-report logic.

MVVM pattern: `CommunityToolkit.Mvvm` for `[ObservableProperty]`, `[RelayCommand]`. Desktop `AGENTS.md` at `client-desktop/src/HoYoMusic.Desktop.App/AGENTS.md` has detailed WinUI 3 conventions (x:Bind, platform detection, MSIX registration, troubleshooting build errors).

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
- `client-desktop/docs/00_DOC_INDEX.md` — desktop docs entrypoint and reading order
- `client-desktop/docs/KNOWN_ISSUES.md` / `client-desktop/docs/PHASE1_CONTRACT_MATRIX.md` — desktop known issues and API parity tracking
