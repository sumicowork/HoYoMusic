# HoYoMusic Desktop

A desktop client for **HoYoMusic**, built with **Tauri v2** wrapping a
**React 19 + Vite 7 + TypeScript** frontend (Ant Design 6, Tailwind 4, zustand).

It shares the same backend REST API and OpenAPI-generated types as the
`web` and `mobile` clients.

## Prerequisites

- **Rust toolchain** (stable) — required to build the Tauri shell.
  Install via [rustup](https://rustup.rs/).
- **Node.js** (LTS, 20+) and npm.
- **WebView2** runtime — preinstalled on Windows 10/11; required by Tauri on Windows.

## Setup & Scripts

```bash
npm install            # install JS dependencies

npm run dev            # start Vite dev server on :5173 (web UI only)

npm run tauri dev      # launch the Tauri desktop window (Vite + Rust shell)

npm run build          # type-check + build the frontend bundle

npm run tauri build    # produce a platform-specific desktop installer
```

## Environment

Copy `.env.example` to `.env` and adjust if needed:

- `VITE_API_BASE` — backend API base path. In Tauri dev it is proxied to
  `localhost:3000`.

## Notes

- Frontend lives in `src/`. The Tauri Rust project lives in `src-tauri/`
  (created by `npm run tauri dev` / `tauri init`).
- Backend REST contracts and OpenAPI types are shared with `web`/`mobile`.
