# AGENTS.md

## Project Map (read this first)
- Monorepo with two runtime apps: `backend/` (Express + PostgreSQL API) and `frontend/` (React + Vite SPA).
- Backend entrypoint is `backend/src/index.ts`; it wires security middleware, the `/api` maintenance gate, route modules, health/docs endpoints, and startup-time DB migrations.
- Frontend entrypoint is `frontend/src/App.tsx`; routes are lazy-loaded and split between public pages and auth-protected admin pages.
- Storage is abstracted behind `backend/src/services/storageService.ts` with three modes: `local`, `oss`, `webdav`.
- Admin music-source management lives in `backend/src/routes/musicSourceRoutes.ts`; startup migrations create the `music_source_*` and `track_music_sources` tables.

## Core Data/Control Flows
- Track upload flow: `frontend/src/services/trackService.ts` -> `POST /api/tracks/upload` -> `backend/src/controllers/trackController.ts`.
- Upload processing includes FLAC magic-byte validation, metadata extraction, optional credits override, storage upload, and transactional DB writes.
- Public playback flow uses `/api/public/tracks/:id/stream` and play-event reporting (`POST /api/public/tracks/:id/play`) in `backend/src/routes/publicRoutes.ts`.
- Cover delivery depends on storage mode; remote covers are proxied via `/api/public/covers/proxy` (same file).
- Analytics logging is request-level via `backend/src/middleware/visitLogger.ts` (batched inserts to `visit_logs`).

## Developer Workflows (project-specific)
- Backend dev: run `npm run dev` in `backend/` (nodemon + ts-node, no separate watcher config).
- Frontend dev: run `npm run dev` in `frontend/`.
- Windows convenience scripts: `start-dev.ps1` launches both apps in new terminals; `stop-dev.ps1` stops node dev processes.
- Initial DB bootstrap is `backend/src/setup.ts` via `npm run setup` (creates/updates default `admin` user).
- Build verification: run `npm run build` in `backend/` and `frontend/`; there is no checked-in `build:static` or `publish-static.ps1` workflow in the repo.

## Conventions You Should Follow
- API response envelope is consistently `{ success, data?, error? }`; preserve this contract in new endpoints.
- Validation pattern: schema in `backend/src/validators/schemas.ts` + `validateBody(...)` in route files (example: `backend/src/routes/trackRoutes.ts`).
- Auth split is intentional: `authenticateJWT` for admin APIs and `authenticateStream` for stream/download token access.
- Frontend service pattern: `frontend/src/services/api.ts` centralizes Axios auth, `x-visitor-id`, 401 login-modal recovery, and optional no-cache headers for authenticated GETs. Feature services import this client, and a few public/admin split flows create a secondary client with `createApiClient(...)`.
- For authenticated GET requests, `frontend/src/services/api.ts` sets `Cache-Control: no-cache`; avoid bypassing this axios instance for admin reads.

## Integration Points / External Dependencies
- PostgreSQL pool config is centralized in `backend/src/config/database.ts`; prefer pooled `pool.query`/transactions over ad-hoc clients.
- OSS/WebDAV initialization occurs during server startup in `backend/src/index.ts`; storage-mode changes can affect boot success.
- Maintenance mode is enforced by `backend/src/middleware/maintenanceMode.ts` before route handling; `backend/src/routes/debugRoutes.ts` stays disabled unless `DEBUG_API_ENABLED=true`, and write SQL also requires `DEBUG_ALLOW_WRITE_SQL=true`.
- Frontend expects backend under `/api` by default (`VITE_API_URL` fallback in `frontend/src/services/api.ts`).
- API docs are served from backend at `/api/docs` (`backend/src/index.ts` + `backend/src/config/swagger.ts`).

## Safe Change Checklist for Agents
- If touching upload/stream paths, verify both authenticated routes (`/api/tracks/...`) and public routes (`/api/public/...`).
- If touching track shape, update the admin controller and any public/frontend consumers that surface the same fields (`backend/src/controllers/trackController.ts`, `backend/src/routes/publicRoutes.ts`, `frontend/src/services/trackService.ts`).
- If adding new DB-backed features, prefer startup migration style in `backend/src/index.ts` for backward-compatible deploys.
- Do not assume tests exist: current `backend/package.json` has a placeholder `test` script; validate with type-check/build paths instead.

