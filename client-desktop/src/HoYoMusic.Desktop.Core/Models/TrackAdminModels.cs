using System.Text.Json.Serialization;

namespace HoYoMusic.Desktop.Core.Models;

public sealed class TrackFilterOptions
{
    [JsonPropertyName("titles")]
    public IReadOnlyList<string> Titles { get; init; } = Array.Empty<string>();

    [JsonPropertyName("albums")]
    public IReadOnlyList<string> Albums { get; init; } = Array.Empty<string>();
}

public sealed class SameAlbumDuplicateTrackItem
{
    [JsonPropertyName("id")]
    public int Id { get; init; }

    [JsonPropertyName("title")]
    public string Title { get; init; } = string.Empty;

    [JsonPropertyName("album_id")]
    public int? AlbumId { get; init; }

    [JsonPropertyName("album_title")]
    public string? AlbumTitle { get; init; }

    [JsonPropertyName("artists")]
    public IReadOnlyList<string> Artists { get; init; } = Array.Empty<string>();
}

public sealed class SameAlbumDuplicateGroup
{
    [JsonPropertyName("album_id")]
    public int? AlbumId { get; init; }

    [JsonPropertyName("album_title")]
    public string AlbumTitle { get; init; } = string.Empty;

    [JsonPropertyName("normalized_title")]
    public string NormalizedTitle { get; init; } = string.Empty;

    [JsonPropertyName("display_title")]
    public string DisplayTitle { get; init; } = string.Empty;

    [JsonPropertyName("duplicate_count")]
    public int DuplicateCount { get; init; }

    [JsonPropertyName("tracks")]
    public IReadOnlyList<SameAlbumDuplicateTrackItem> Tracks { get; init; } = Array.Empty<SameAlbumDuplicateTrackItem>();
}

public sealed class TrackNotesImportEntry
{
    [JsonPropertyName("row_key")]
    public string RowKey { get; init; } = string.Empty;

    [JsonPropertyName("song_name")]
    public string SongName { get; init; } = string.Empty;

    [JsonPropertyName("song_number")]
    public string? SongNumber { get; init; }

    [JsonPropertyName("note_lines")]
    public IReadOnlyList<string> NoteLines { get; init; } = Array.Empty<string>();
}

public sealed class TrackNotesImportCandidate
{
    [JsonPropertyName("track_id")]
    public int TrackId { get; init; }

    [JsonPropertyName("title")]
    public string Title { get; init; } = string.Empty;

    [JsonPropertyName("track_number")]
    public int? TrackNumber { get; init; }

    [JsonPropertyName("album_title")]
    public string AlbumTitle { get; init; } = string.Empty;

    [JsonPropertyName("artists")]
    public string Artists { get; init; } = string.Empty;
}

public sealed class TrackNotesImportItem
{
    [JsonPropertyName("row_key")]
    public string RowKey { get; init; } = string.Empty;

    [JsonPropertyName("song_name")]
    public string SongName { get; init; } = string.Empty;

    [JsonPropertyName("song_number_raw")]
    public string SongNumberRaw { get; init; } = string.Empty;

    [JsonPropertyName("status")]
    public string Status { get; init; } = string.Empty;

    [JsonPropertyName("message")]
    public string? Message { get; init; }

    [JsonPropertyName("matched_track_id")]
    public int? MatchedTrackId { get; init; }

    [JsonPropertyName("note_lines_count")]
    public int NoteLinesCount { get; init; }

    [JsonPropertyName("candidates")]
    public IReadOnlyList<TrackNotesImportCandidate>? Candidates { get; init; }
}

public sealed class TrackNotesImportSummary
{
    [JsonPropertyName("total")]
    public int Total { get; init; }

    [JsonPropertyName("matched")]
    public int Matched { get; init; }

    [JsonPropertyName("needs_manual")]
    public int NeedsManual { get; init; }

    [JsonPropertyName("not_found")]
    public int NotFound { get; init; }

    [JsonPropertyName("invalid")]
    public int Invalid { get; init; }

    [JsonPropertyName("imported")]
    public int Imported { get; init; }

    [JsonPropertyName("skipped")]
    public int Skipped { get; init; }

    [JsonPropertyName("error")]
    public int Error { get; init; }
}

public sealed class TrackNotesImportPreviewResult
{
    [JsonPropertyName("summary")]
    public TrackNotesImportSummary Summary { get; init; } = new();

    [JsonPropertyName("items")]
    public IReadOnlyList<TrackNotesImportItem> Items { get; init; } = Array.Empty<TrackNotesImportItem>();
}

public sealed class TrackNotesImportCommitResult
{
    [JsonPropertyName("summary")]
    public TrackNotesImportSummary Summary { get; init; } = new();

    [JsonPropertyName("items")]
    public IReadOnlyList<TrackNotesImportItem> Items { get; init; } = Array.Empty<TrackNotesImportItem>();
}

public sealed class CatalogMetadataImportAlbumItem
{
    [JsonPropertyName("uuid")]
    public string Uuid { get; init; } = string.Empty;

    [JsonPropertyName("title")]
    public string? Title { get; init; }

    [JsonPropertyName("title_cn")]
    public string? TitleCn { get; init; }

    [JsonPropertyName("title_en")]
    public string? TitleEn { get; init; }
}

public sealed class CatalogMetadataImportTrackItem
{
    [JsonPropertyName("uuid")]
    public string Uuid { get; init; } = string.Empty;

    [JsonPropertyName("title")]
    public string? Title { get; init; }

    [JsonPropertyName("title_cn")]
    public string? TitleCn { get; init; }

    [JsonPropertyName("title_en")]
    public string? TitleEn { get; init; }
}

public sealed class CatalogMetadataImportPayload
{
    [JsonPropertyName("sync_legacy_title")]
    public bool SyncLegacyTitle { get; init; }

    [JsonPropertyName("albums")]
    public IReadOnlyList<CatalogMetadataImportAlbumItem> Albums { get; init; } = Array.Empty<CatalogMetadataImportAlbumItem>();

    [JsonPropertyName("tracks")]
    public IReadOnlyList<CatalogMetadataImportTrackItem> Tracks { get; init; } = Array.Empty<CatalogMetadataImportTrackItem>();
}

public sealed class CatalogMetadataImportResult
{
    [JsonPropertyName("summary")]
    public Dictionary<string, int> Summary { get; init; } = new();

    [JsonPropertyName("batch_uuid")]
    public string? BatchUuid { get; init; }

    [JsonPropertyName("dry_run")]
    public bool DryRun { get; init; }
}

public sealed class CatalogMetadataRollbackResult
{
    [JsonPropertyName("batch_uuid")]
    public string BatchUuid { get; init; } = string.Empty;

    [JsonPropertyName("albums_reverted")]
    public int AlbumsReverted { get; init; }

    [JsonPropertyName("tracks_reverted")]
    public int TracksReverted { get; init; }
}

public sealed class BinaryFileResult
{
    public byte[] Content { get; init; } = Array.Empty<byte>();

    public string FileName { get; init; } = string.Empty;

    public string ContentType { get; init; } = "application/octet-stream";
}

public sealed class TrackUploadResult
{
    [JsonPropertyName("tracks")]
    public IReadOnlyList<TrackUploadItem> Tracks { get; init; } = Array.Empty<TrackUploadItem>();
}

public sealed class TrackUploadItem
{
    [JsonPropertyName("id")]
    public int Id { get; init; }

    [JsonPropertyName("title")]
    public string Title { get; init; } = string.Empty;
}

public sealed class TrackCreditPreviewItem
{
    [JsonPropertyName("filename")]
    public string FileName { get; init; } = string.Empty;

    [JsonPropertyName("credits")]
    public IReadOnlyList<CreditPreviewEntry> Credits { get; init; } = Array.Empty<CreditPreviewEntry>();
}

public sealed class CreditPreviewEntry
{
    [JsonPropertyName("key")]
    public string Key { get; init; } = string.Empty;

    [JsonPropertyName("value")]
    public string Value { get; init; } = string.Empty;
}

