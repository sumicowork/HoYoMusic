# Music Source Import/Export Spec (v1.0)

## Goal

Define a structured `music source` format for track origins. This is separate from plain `tracks.notes`.

- New module stores structured source data in dedicated relation tables.
- Old note/location format is still treated as plain notes import.
- In other words: legacy `location` text keeps flowing into normal notes, while the new module only accepts structured music-source data.

## Import Match Rule

Track matching priority is:

1. `song_name + song_number`
2. if multiple results, use `album_name` to disambiguate
3. if still multiple, mark `needs_manual`

Matching field mapping (updated):

- `song_name` matches **English track title only** (`tracks.title_en`)
- `album_name` matches **English album title only** (`albums.title_en`)
- Chinese/bilingual display names are **not** used for matching
- Comparison is case-insensitive, but still exact-text match after trimming

## Import Payload

Each `entries[]` item represents one track. Each `sources[]` item represents one independent source record for that track.

`path` is an ordered hierarchy from top level to leaf level. It is **not** a list of parallel items.

Example meaning of `path: ["蒙德", "坠星山谷", "蒙德城", "白天"]`:

- 一级：蒙德
- 二级：坠星山谷
- 三级：蒙德城
- 四级：白天

```json
{
  "entries": [
    {
      "row_key": "1",
      "song_name": "A Day in Mondstadt",
      "song_number": "07",
      "album_name": "The Wind and The Star Traveler",
      "game_id": 1,
      "sources": [
        {
          "category": "场景音乐",
          "path": ["蒙德", "坠星山谷", "蒙德城", "白天"]
        }
      ]
    }
  ]
}
```

If a track has multiple sources, add multiple objects in `sources[]`; do not merge them into one `path` array.

### UUID-aware precise replacement (recommended)

To support rename/translation without creating duplicate nodes, each source can carry stable UUID locators:

- `category_uuid`: UUID of the category
- `path_node_uuids`: UUID chain aligned with `path` order
- `node_uuid`: UUID of the leaf node (should equal the last item of `path_node_uuids` when both exist)

When UUID fields are provided, import resolves by UUID first and updates names in place.

## Export Payload

Supported scopes:

- `all`
- `by_game` (requires `game_ids`; only sources in those games are exported)
- `by_album` (requires `album_ids`; only tracks in those albums are exported)
- `by_category` (requires `category_ids`; only sources in those categories are exported)

Scope rules:

- `all`: export every structured music source record.
- `by_game`: `game_ids` is required; `album_ids` is ignored.
- `by_album`: `album_ids` is required; `game_ids` is ignored.

```json
{
  "scope": "by_game",
  "game_ids": [1]
}
```

Response file shape:

- `entries[]` is the top-level exported track list.
- `sources[]` is the per-track source list.
- `song_number` is serialized as a string when exported.
- `song_name` and `album_name` in export are English names for re-import matching.

```json
{
  "version": "1.0",
  "scope": "by_game",
  "entries": [
    {
      "track_id": 123,
      "album_name": "The Wind and The Star Traveler",
      "song_name": "A Day in Mondstadt",
      "song_number": "07",
      "game_id": 1,
      "game_name": "原神",
      "sources": [
        {
          "category": "场景音乐",
          "path": ["蒙德", "坠星山谷", "蒙德城", "白天"]
        }
      ]
    }
  ]
}
```

## API Endpoints (Admin)

- `GET /api/music-sources/categories?game_id=...`
- `POST /api/music-sources/categories`
- `PUT /api/music-sources/categories/:id`
- `DELETE /api/music-sources/categories/:id`
- `GET /api/music-sources/nodes?game_id=...&category_id=...&parent_id=...`
- `POST /api/music-sources/nodes`
- `PUT /api/music-sources/nodes/:id`
- `DELETE /api/music-sources/nodes/:id`
- `GET /api/music-sources/tracks/:trackId`
- `POST /api/music-sources/tracks/:trackId`
- `POST /api/music-sources/import/preview`
- `POST /api/music-sources/import/commit`
- `POST /api/music-sources/export`


