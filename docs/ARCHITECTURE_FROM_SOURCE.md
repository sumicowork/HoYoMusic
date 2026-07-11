# HoYoMusic — Architecture & Operations (Verified from Source)

> **Provenance note.** This file was written by reading the actual source (package.json,
> `backend/src/index.ts`, `backend/src/config/swagger.ts`, `backend/db/schema.sql`, client
> build files). Existing `README.md` / `CLAUDE.md` / `docs/` prose are treated as unreliable
> and were **not** used as a source of truth. Claims are cited to files. Items I could not
> confirm are marked **[UNVERIFIED]** or **[CONTEXT]** (comes from project context, not verified here).

---

## 1. System Overview

HoYoMusic is a miHoYo / HoYoverse game-music catalog and player. It has **one backend** (REST API)
and **three clients** that all talk to the same REST contract:

| Component | Path | Stack | Runtime |
|---|---|---|---|
| Backend API | `backend/` | Express 5 + TypeScript + PostgreSQL | Node, port `:3000` |
| Web client | `frontend/` | React 19 + Vite 7 + Ant Design | Browser |
| Desktop client | `desktop/` | Tauri v2 (Rust shell) + React 19 + TypeScript | Windows/macOS/Linux (Tauri 2) |
| Mobile client | `client-mobile/` | Kotlin + Jetpack Compose (Android) | Android |

Production API base URL (hardcoded in desktop & mobile): `https://music.hoyodb.com/api/`
(`desktop/src/lib/api.ts` → `VITE_API_BASE`, `client-mobile/android/app/build/.../BuildConfig.java:13`).

---

## 2. Tech Stack (per component, cited)

### Backend — `backend/package.json`
- **express** `^5.2.1` (Express 5), **pg** `^8.18.0` (PostgreSQL driver)
- Auth: **passport** `^0.7.0`, **passport-jwt**, **passport-local**, **jsonwebtoken**, **bcrypt** `^6.0.0`
- Docs: **swagger-jsdoc** `^6.2.8` + **swagger-ui-express** `^5.0.1`
- Validation: **zod** `^4.3.6`; security: **helmet**, **cors**, **compression**, **express-rate-limit**
- Storage integrations: **ali-oss** (Alibaba OSS), **webdav**; media: **music-metadata**, **sharp**
- Dev: **ts-node**, **nodemon**, **typescript** `^5.9.3`, **vitest** `^3.2.7`

### Web client — `frontend/package.json`
- **react** `^19.2.0`, **react-dom** `^19.2.0`, **vite** `^7.2.4`, **typescript** `~5.9.3`
- UI: **antd** `^6.2.3` (note: v6, not v5), **@ant-design/icons** `^6.1.0`
- Routing **react-router-dom** `^7.13.0`; audio **howler** `^2.2.4`; state **zustand** `^5.0.11`
- Charts **recharts**, animation **framer-motion**, markdown **react-markdown**
- Styling: **tailwindcss** `^4.1.4` (via `@tailwindcss/vite`)

### Desktop client — `desktop/` (Tauri v2 + React)
- `desktop/package.json`: React 19 + Vite 7 + TypeScript + Ant Design 6 + Tailwind 4 + zustand
- `desktop/src-tauri/`: Rust shell (Tauri v2) — `Cargo.toml`, `src/lib.rs`, `src/commands.rs` (native commands: media metadata/playback, tray, global shortcut, offline download), `tauri.conf.json`, `capabilities/`
- `desktop/src/`: independent React+TS UI — `App.tsx`, `router.tsx`, `pages/`, `components/{player,layout,ui}/`, `store/playerStore.ts`, `lib/api.ts`, `lib/tauri.ts`, `hooks/` (audio + media session + shortcuts + tray), `generated/api-types.ts` (from OpenAPI)
- Distinct UI from `frontend/` (no shared components); shares only the backend REST contract + OpenAPI types
- Native integrations via Tauri: system media transport (SMTC), tray + mini player, global shortcuts, offline download [UNVERIFIED: exact capabilities pending `desktop/` source]

### Mobile client — `client-mobile/android/`
- Gradle Kotlin DSL; Kotlin Android + **Jetpack Compose**
  (`id("org.jetbrains.kotlin.plugin.compose")`, `compose-bom:2024.09.00`, `material3`)
- `app/build.gradle.kts`: `compileSdk = 34`, `minSdk = 26`
- Hilt/Dagger for DI, Coroutines, Navigation Compose

---

## 3. Repository Layout

```
backend/            Express API + PostgreSQL access + storage (local/webdav/oss)
  src/index.ts      App bootstrap, middleware, route mounting
  src/config/       swagger.ts, database.ts, passport.ts, webdav.ts, oss.ts
  src/routes/       one file per resource (auth, tracks, albums, ...)
  db/schema.sql     Live DB dump (27 tables) — SOURCE OF TRUTH
  db/migrations/    SQL migrations (0001_init.sql present)
frontend/           React web client (Vite)
desktop/           Tauri v2 + React desktop client (Rust shell + independent React UI)
client-mobile/      Kotlin + Compose Android client
```

Root `package.json` contains only `copilot-api` and is **not** a workspace root — each
component installs/runs independently.

---

## 4. How to Run (dev)

### Backend (`backend/`)
```bash
cp .env.example .env          # fill DB_* and secrets
npm install
npm run dev                   # nodemon + ts-node src/index.ts  (port 3000)
npm run build && npm start    # compile then run dist/index.js
npm run setup                 # ts-node src/setup.ts (seed/init) [verify what it does]
npm run migrate               # ts-node scripts/migrate.ts
npm test                      # vitest run
```
Key env (`backend/.env.example`): `PORT`, `DB_HOST/PORT/NAME/USER/PASSWORD`,
`JWT_SECRET`, `STORAGE_MODE` (`local|webdav|oss`), `UPLOAD_DIR`, SMTP `MAIL_*`.

### Web client (`frontend/`)
```bash
npm install
npm run dev                   # vite dev server
npm run build                 # tsc && vite build
npm run preview
```
API base = `import.meta.env.VITE_API_URL` or **same-origin `/api`**
(`frontend/src/components/AlbumCoverUpload.tsx:8`). In dev, `/api` must be proxied to the backend.

### Desktop client (`desktop/` — Tauri v2)
```bash
cd desktop
npm install
npm run dev          # Vite dev server on :5173, proxies /api to backend :3000 (root: npm run desktop:dev)
npm run build        # build web assets (root: npm run desktop:build)
npm run tauri        # Tauri CLI: dev / build / package the native shell (root: npm run desktop:tauri)
```
Requires Rust toolchain + Node + WebView2 (Windows/macOS/Linux via Tauri 2). API base defaults to
`/api` (Vite dev proxy → backend :3000) or `https://music.hoyodb.com/api/` in packaged builds.

### Mobile client (`client-mobile/android/`)
```bash
# Open in Android Studio, or:
./gradlew assembleDebug        # [UNVERIFIED: exact gradle task not run here]
```
API base hardcoded in generated `BuildConfig.API_BASE_URL = "https://music.hoyodb.com/api/"`.

---

## 5. API Contract

- **Base path:** `/api` (mounted in `backend/src/index.ts:163,188-214`)
- **Swagger UI (interactive):** `http://localhost:3000/api/docs`
- **OpenAPI JSON:** `http://localhost:3000/api/docs.json` (`backend/src/index.ts:217-218`)
- **Spec definition:** `backend/src/config/swagger.ts` — OpenAPI `3.0.0`, title
  *"HoYoMusic API"*, version `3.5.0`. The spec is **generated at runtime** by
  `swagger-jsdoc` from JSDoc `@openapi` annotations in the route files + the central
  definition. **No static committed OpenAPI/Swagger YAML exists** in the repo.
- **Health:** `GET /api/health` (`backend/src/index.ts:221`).

### Route map (verified prefixes)
| Prefix | File | Auth |
|---|---|---|
| `/api/auth` | authRoutes | public (login/register) |
| `/api/tracks` | trackRoutes | admin |
| `/api/lyrics`, `/api/credits` | lyricsRoutes, creditsRoutes | — |
| `/api/albums`, `/api/artists`, `/api/games`, `/api/tags` | *Routes | mixed |
| `/api/playlists`, `/api/favorites` | playlistRoutes, favoriteRoutes | authenticated |
| `/api/analytics` | analyticsRoutes | authenticated |
| `/api/public` | publicRoutes | public |
| `/api` (disc/settings/users/messages/music-sources) | disc/settings/user/message/musicSourceRoutes | mixed |
| `/api/debug` | debugRoutes | **off unless `DEBUG_API_ENABLED=true`** |
| `/api/docs`, `/api/docs.json` | swagger | public |

Auth model: JWT Bearer (`bearerAuth` in swagger components). Global rate limiter on `/api`
plus targeted limiters for auth/register/verification (`backend/src/index.ts:89-116`).
Maintenance-mode guard on `/api` (`maintenanceModeGuard`).

---

## 6. Database Truth Rule

1. **The live PostgreSQL database is the source of truth.**
2. `backend/db/schema.sql` is a **regenerated `pg_dump`** (header: "Dumped from database
   version 18.2", `-- Dumped by pg_dump version 18.2`), containing **27 `CREATE TABLE`
   statements**. Treat it as the authoritative schema snapshot.
3. **Do not edit `schema.sql` by hand to change the schema.** To change the schema, add a
   migration under `backend/db/migrations/` and run `npm run migrate`.
4. **Drift detection:** `schema.sql` should be regenerated from a fresh dump after schema
   changes so it stays in sync with the live DB. Drift tests are **[CONTEXT] being added** —
   only `0001_init.sql` is currently present in `backend/db/migrations/`; the drift-test
   harness was not located in this pass and should be confirmed before relying on it.
5. `init_db.sql` has been **[CONTEXT] removed** (per project state); `0001_init.sql`
   supersedes it. **[UNVERIFIED]** — recommend confirming no other code still references `init_db.sql`.

Storage of audio/cover assets is pluggable via `STORAGE_MODE` (`local` filesystem,
`webdav`, or Alibaba `oss`); see `backend/.env.example`.

---

## 7. Multi-Client / Shared Contract

- All three clients consume the **same REST API**; there is no per-client backend.
- Desktop (`desktop/src/lib/api.ts` → `VITE_API_BASE`, default `/api`) and Mobile (Kotlin `BuildConfig`) point at the **prod**
  `https://music.hoyodb.com/api/` by default.
- Web client points at **same-origin `/api`** and expects a dev proxy to the backend when
  developing locally. Set `VITE_API_URL` to override.
- Implication: any breaking API change affects all three clients simultaneously. Keep the
  OpenAPI spec (`/api/docs.json`) as the single contract reference; mobile/desktop models
  are hand-written clients of that contract.

---

## 8. Known Caveats

- **"Shit mountain" / multi-AI maintenance.** The codebase is large and jointly edited by
  multiple AI agents; inconsistent patterns and duplicated logic are expected.
- **Dead-code cleanup in progress [CONTEXT].** Expect unused exports/routes to be removed;
  do not assume every route/file is wired into a client.
- **Tests were historically absent.** Backend now declares `vitest` (`npm test`) and the
  backend has `vitest` drift + contract tests (partial coverage); the new `desktop/` Tauri client
  has **no tests yet** [UNVERIFIED]. Do not assume green tests imply full correctness. Mobile
  tests were not located in this pass
  **[UNVERIFIED]**.
- **`DEBUG_API_ENABLED` routes** (`/api/debug`) are high-risk and disabled by default.
- **Prose docs unreliable.** `README.md`, `CLAUDE.md`, and the `docs/` narrative files
  (incl. old `client-desktop/` WinUI 3 docs, now removed) may be stale/contradictory; prefer source + `/api/docs`.

---

## 9. Operations Runbook (quick)

| Task | Command |
|---|---|
| Start API locally | `cd backend && npm run dev` (needs `.env`) |
| Regenerate schema snapshot | `pg_dump ... > backend/db/schema.sql` from live DB |
| Apply migrations | `cd backend && npm run migrate` |
| Inspect live API docs | open `http://localhost:3000/api/docs` |
| Health check | `curl localhost:3000/api/health` |
| Build all clients | backend `npm run build`; web `npm run build`; desktop `npm run desktop:build`; mobile `./gradlew assembleDebug` |

**Onboarding a schema change:**
1. Add `backend/db/migrations/00NN_*.sql`.
2. `npm run migrate` against the target DB.
3. Regenerate `backend/db/schema.sql` from the updated live DB.
4. Update swagger JSDoc if the contract changed; re-check `/api/docs.json`.
5. Verify affected clients (web proxy, desktop & mobile hardcoded base still valid).

---

*Uncertainties to resolve later: exact mobile Gradle tasks; existence/behavior of drift-test
harness; confirmation that `init_db.sql` is fully removed and unreferenced; mobile test presence.*
