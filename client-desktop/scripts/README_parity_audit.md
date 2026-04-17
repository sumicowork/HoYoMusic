# Frontend/Desktop Code Audit Script

This script performs a code-only parity audit by traversing:

- `frontend/src` (`.ts`, `.tsx`, `.css`)
- `client-desktop/src` (`.cs`, `.xaml`)

It does not read existing parity documents for classification.

## Script

- `client-desktop/scripts/audit_frontend_desktop_parity.py`

## What it outputs

1. Markdown report with summary + file-by-file status
2. JSON report with machine-readable rows

## Run (PowerShell)

```powershell
python "C:\Users\sumi\WebstormProjects\HoYoMusic\client-desktop\scripts\audit_frontend_desktop_parity.py" `
  --repo "C:\Users\sumi\WebstormProjects\HoYoMusic" `
  --md "C:\Users\sumi\WebstormProjects\HoYoMusic\client-desktop\docs\07_FRONTEND_DESKTOP_CODE_AUDIT_2026-04-16.md" `
  --json "C:\Users\sumi\WebstormProjects\HoYoMusic\client-desktop\docs\07_FRONTEND_DESKTOP_CODE_AUDIT_2026-04-16.json"
```

## Notes

- `MATCHED/PARTIAL/MISSING` is heuristic for UI files.
- Service-layer matching is stricter (checks `I*Service.cs` + `*Service.cs`).
- Use this as a reproducible baseline, then do targeted manual confirmation for `PARTIAL` rows.

