# Known Issues (PoC)

## Build/Runtime

- First-time restore for WinUI dependencies can be slow on unstable networks.
- PoC is validated through `dotnet build` + `dotnet test` + `scripts/startup-smoke.ps1`; no packaged installer flow yet.

## Functional

- Playback uses public stream endpoint and does not report play events.
- Track list currently only surfaces title and album fields.
- No offline cache or local download support in this phase.

## Security

- Access token is stored in Windows Credential Locker (not plaintext files), but token rotation and expiry refresh are not implemented yet.

