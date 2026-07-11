f = "docs/ARCHITECTURE_FROM_SOURCE.md"
s = open(f, encoding="utf-8").read()

repls = []

repls.append((
    "Production API base URL (hardcoded in desktop & mobile): `https://music.hoyodb.org/api/`\n"
    "(`client-desktop/.../ApiConstants.cs:5`, `client-mobile/android/app/build/.../BuildConfig.java:13`).",
    "Production API base URL (hardcoded in mobile): `https://music.hoyodb.org/api/`\n"
    "(`client-mobile/android/app/build/.../BuildConfig.java:13`). The desktop client uses `VITE_API_BASE`, "
    "proxied to `localhost:3000` in Tauri dev [UNVERIFIED: production base URL not confirmed in this pass]."
))

repls.append((
    "### Desktop client — `client-desktop/`\n"
    "- `global.json`: SDK `8.0.419`, `rollForward: latestPatch`\n"
    "- `.csproj` (`src/HoYoMusic.Desktop.App/HoYoMusic.Desktop.App.csproj`):\n"
    "  `TargetFramework=net8.0-windows10.0.26100.0`, `<UseWinUI>true</UseWinUI>`,\n"
    "  `Microsoft.WindowsAppSDK` `1.8.260317003` → **WinUI 3**\n"
    "- Projects: `.App` (WinUI UI), `.Core` (net8.0), `.Infrastructure` (net8.0-windows)\n"
    "- Has a test project: `tests/HoYoMusic.Desktop.Tests/`",
    "### Desktop client — `desktop/`\n"
    "- `package.json`: `react ^19.2.0`, `vite ^7.2.4`, `typescript ~5.9.3`, `antd ^6.2.3`,\n"
    "  `@tauri-apps/api ^2.5.0`, `@tauri-apps/cli ^2.5.0`, `zustand ^5.0.11`, `openapi-typescript ^7.13.0`.\n"
    "- `src-tauri/Cargo.toml`: `tauri` v2, `tauri-plugin-window-state`, `tauri-plugin-global-shortcut`.\n"
    "- Rust shell entry: `src-tauri/src/lib.rs` + `src/commands.rs` (native command surface).\n"
    "- OpenAPI-generated TS types under `desktop/src/generated/` (from `openapi/openapi.json`).\n"
    "- Independent React UI (distinct from `frontend/`); no shared components."
))

repls.append(
    "client-desktop/     .NET 8 WinUI 3 desktop client (sln)",
    "desktop/           Tauri v2 + React 19 desktop client (independent UI from frontend/)"
)

repls.append((
    "### Desktop client (`client-desktop/`)\n"
    "```bash\n"
    "dotnet restore HoYoMusic.Desktop.sln\n"
    "dotnet build HoYoMusic.Desktop.sln -c Debug\n"
    "dotnet run --project .\\src\\HoYoMusic.Desktop.App\\HoYoMusic.Desktop.App.csproj\n"
    "dotnet test HoYoMusic.Desktop.sln -c Debug --no-build\n"
    "```\n"
    "Requires Windows + .NET 8 SDK. API base defaults to `https://music.hoyodb.org/api/`\n"
    "(`ApiConstants.cs:5`), overridable at startup (`CoverPathHelper.cs:36`).",
    "### Desktop client (`desktop/`)\n"
    "```bash\n"
    "npm install\n"
    "npm run dev            # Vite dev server on :5173 (web UI only)\n"
    "npm run tauri dev      # launch Tauri window (Vite + Rust shell)\n"
    "npm run build          # type-check + build frontend bundle\n"
    "npm run tauri build    # platform-specific installer\n"
    "# repo-root convenience: npm run desktop:dev / desktop:build / desktop:tauri\n"
    "```\n"
    "Requires Rust toolchain + WebView2 (Windows). API base = `VITE_API_BASE`, proxied to\n"
    "`localhost:3000` in Tauri dev [UNVERIFIED: production base URL]."
))

repls.append(
    "- Desktop (C# `ApiConstants.cs`) and Mobile (Kotlin `BuildConfig`) point at the **prod**",
    "- Mobile (Kotlin `BuildConfig`) points at the **prod**"
)
repls.append(
    "  are hand-written clients of that contract.",
    "  are hand-written clients of that contract; the desktop client uses OpenAPI-generated types (not hand-written)."
)

repls.append(
    "  desktop client has a real xUnit-style test project, but **coverage is partial**",
    "  desktop client's old xUnit test project was removed with the WinUI 3 client [UNVERIFIED: no desktop tests currently present]"
)

repls.append(
    "  (incl. `client-desktop/docs/*`) may be stale/contradictory; prefer source + `/api/docs`.",
    "  may be stale/contradictory; prefer source + `/api/docs` + `openapi/openapi.json`."
)

repls.append(
    "  definition. **No static committed OpenAPI/Swagger YAML exists** in the repo.",
    "  definition. A committed snapshot also lives at `openapi/openapi.json` (generated TS types in\n"
    "  `frontend/src/generated/api-types.ts` and `desktop/src/generated/` are derived from it) "
    "[UNVERIFIED: refresh process]."
)

repls.append(
    "| Build all clients | backend `npm run build`; web `npm run build`; desktop `dotnet build`; mobile `./gradlew assembleDebug` |",
    "| Build all clients | backend `npm run build`; web `npm run build`; desktop `npm run desktop:build` + `npm run desktop:tauri build`; mobile `./gradlew assembleDebug` |"
)

missing = []
for old, new in repls:
    if old in s:
        s = s.replace(old, new, 1)
    else:
        missing.append(old[:70])

open(f, "w", encoding="utf-8").write(s)
print("missing:", missing if missing else "none")
