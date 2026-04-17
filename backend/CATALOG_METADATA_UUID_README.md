# Catalog Metadata UUID Migration

## What was added

- `albums.uuid` / `tracks.uuid` with unique indexes.
- `albums.title_cn` / `albums.title_en`.
- `tracks.title_cn` / `tracks.title_en`.
- Admin export API: `GET /api/tracks/metadata-export`.
- Admin preview API: `POST /api/tracks/metadata-import/preview`.
- Admin commit API: `POST /api/tracks/metadata-import/commit`.
- Admin rollback API: `POST /api/tracks/metadata-import/rollback`.
- Compatibility API: `POST /api/tracks/metadata-import/replace-by-uuid`.

## Safe rollout notes

- Startup migration in `src/index.ts` backfills missing UUIDs.
- Startup migration backfills `title_cn` from legacy `title`.
- Existing `id` PKs are unchanged.
- Existing API payloads remain compatible.

## API examples

### Export

`GET /api/tracks/metadata-export`

Response file includes:

- `albums[]`: `id`, `uuid`, `title`, `title_cn`, `title_en`, ...
- `tracks[]`: `id`, `uuid`, `album_uuid`, `title`, `title_cn`, `title_en`, ...

### Replace by UUID

`POST /api/tracks/metadata-import/replace-by-uuid`

### Preview by UUID (dry-run)

`POST /api/tracks/metadata-import/preview`

- Validates UUID mapping and change counts.
- Does not write data.

### Commit by UUID (audited)

`POST /api/tracks/metadata-import/commit`

- Applies changes.
- Writes an audit batch and returns `batch_uuid`.

### Rollback one batch

`POST /api/tracks/metadata-import/rollback`

```json
{
  "batch_uuid": "33333333-3333-3333-3333-333333333333"
}
```

- Restores all title fields in that batch (`title`, `title_cn`, `title_en`).
- A rolled-back batch cannot be rolled back again.

```json
{
  "sync_legacy_title": false,
  "albums": [
    {
      "uuid": "11111111-1111-1111-1111-111111111111",
      "title_cn": "原声带",
      "title_en": "Original Soundtrack"
    }
  ],
  "tracks": [
    {
      "uuid": "22222222-2222-2222-2222-222222222222",
      "title_cn": "璃月",
      "title_en": "Liyue"
    }
  ]
}
```

`sync_legacy_title = true` will also update legacy `title` when `title` is present in payload.

## Validation

Run TypeScript check:

```powershell
Set-Location "C:\Users\sumi\WebstormProjects\HoYoMusic\backend"
npx tsc --pretty false --noEmit
```


