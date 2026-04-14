# HoYoMusic Windows Native Client (PoC)

Windows native desktop PoC built with .NET 8, WinUI 3, and MVVM.

## Scope (Current Desktop Iteration)

- WinUI 3 desktop app scaffold and solution structure.
- Admin login flow (`POST /api/auth/login`).
- Secure token persistence using Windows Credential Locker (`PasswordVault`).
- Game-first archive browsing (`games -> albums -> tracks`).
- Home-style discovery with random tracks and selected-game albums.
- Album detail panel with track list and one-click album playback (`GET /api/albums/{id}`).
- Online stream playback (`/api/public/tracks/{id}/stream`) with queue continuation.
- Play mode support aligned with Web semantics: `sequence`, `loop`, `shuffle`, `single`.
- Progress scrubbing, auto next behavior, and in-player queue management.
- Admin entry is hidden for non-admin users.
- API envelope parsing with `{ success, data?, error? }` contract.
- Download queue service scaffold (`IDownloadService`) for next-phase task orchestration.

## Project Structure

- `client-desktop/src/HoYoMusic.Desktop.App` - WinUI UI + ViewModel wiring.
- `client-desktop/src/HoYoMusic.Desktop.Core` - interfaces, DTO/contracts, domain models.
- `client-desktop/src/HoYoMusic.Desktop.Infrastructure` - HTTP services + credential storage.
- `client-desktop/tests/HoYoMusic.Desktop.Tests` - xUnit smoke tests for service behavior.

## Backend Integration

- Default base URL: `https://music.hoyodb.com/api/`
- Override base URL: set env var `HOYOMUSIC_API_BASE_URL`
- Auth: `Authorization: Bearer <token>` for admin track list.
- Public stream endpoint used for playback to keep PoC simple.

## Build and Test

```powershell
Set-Location "C:\Users\sumi\WebstormProjects\HoYoMusic\client-desktop"
dotnet build HoYoMusic.Desktop.sln
dotnet test .\tests\HoYoMusic.Desktop.Tests\HoYoMusic.Desktop.Tests.csproj --no-build
```

## Run (PoC)

```powershell
Set-Location "C:\Users\sumi\WebstormProjects\HoYoMusic\client-desktop"
dotnet run --project .\src\HoYoMusic.Desktop.App\HoYoMusic.Desktop.App.csproj -r win-x86
```

## Known Limitations

- Login/track loading error display is basic text only.
- No refresh token and no proactive token expiry handling yet.
- Playback uses direct public stream URI without advanced retry/quality strategies.
- Download queue is currently in-memory scaffold only (no real file transfer yet).

## Next Phase TODO

1. Download executor: implement actual file transfer, retry, and persistence.
2. Update mechanism: release channel support and rollback-safe updater.
3. Logging/reporting: local structured logs and optional remote diagnostics upload.

## Delivery Docs

- `client-desktop/docs/00_DOC_INDEX.md` - desktop docs entrypoint and reading order.
- `client-desktop/docs/01_EXECUTION_TRACKER.md` - phase execution tracker and current sprint tasks.

