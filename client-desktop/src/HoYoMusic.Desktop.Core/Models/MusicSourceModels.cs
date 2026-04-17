using System.Text.Json.Serialization;

namespace HoYoMusic.Desktop.Core.Models;

public sealed class TrackMusicSourceItem
{
    [JsonPropertyName("id")]
    public int Id { get; init; }

    [JsonPropertyName("category_name")]
    public string? CategoryName { get; init; }

    [JsonPropertyName("node_name")]
    public string? NodeName { get; init; }

    [JsonPropertyName("path")]
    public IReadOnlyList<string> Path { get; init; } = Array.Empty<string>();

    [JsonIgnore]
    public string DisplayText => Path.Count > 0
        ? string.Join(" / ", Path)
        : $"{CategoryName ?? "Unknown"} / {NodeName ?? "Unknown"}";
}

public sealed class TrackMusicSourceResponseData
{
    [JsonPropertyName("items")]
    public IReadOnlyList<TrackMusicSourceItem> Items { get; init; } = Array.Empty<TrackMusicSourceItem>();
}

public sealed class MusicSourceCategoryItem
{
    [JsonPropertyName("id")]
    public int Id { get; init; }

    [JsonPropertyName("uuid")]
    public string? Uuid { get; init; }

    [JsonPropertyName("game_id")]
    public int GameId { get; init; }

    [JsonPropertyName("name")]
    public string Name { get; init; } = string.Empty;

    [JsonPropertyName("description")]
    public string? Description { get; init; }

    [JsonPropertyName("display_order")]
    public int DisplayOrder { get; init; }
}

public sealed class MusicSourceNodeItem
{
    [JsonPropertyName("id")]
    public int Id { get; init; }

    [JsonPropertyName("uuid")]
    public string? Uuid { get; init; }

    [JsonPropertyName("game_id")]
    public int GameId { get; init; }

    [JsonPropertyName("category_id")]
    public int CategoryId { get; init; }

    [JsonPropertyName("parent_id")]
    public int? ParentId { get; init; }

    [JsonPropertyName("name")]
    public string Name { get; init; } = string.Empty;

    [JsonPropertyName("display_order")]
    public int DisplayOrder { get; init; }
}

public sealed class MusicSourceCategoryUpsertRequest
{
    [JsonPropertyName("game_id")]
    public int GameId { get; init; }

    [JsonPropertyName("name")]
    public string Name { get; init; } = string.Empty;

    [JsonPropertyName("description")]
    public string? Description { get; init; }

    [JsonPropertyName("display_order")]
    public int? DisplayOrder { get; init; }
}

public sealed class MusicSourceNodeUpsertRequest
{
    [JsonPropertyName("game_id")]
    public int GameId { get; init; }

    [JsonPropertyName("category_id")]
    public int CategoryId { get; init; }

    [JsonPropertyName("parent_id")]
    public int? ParentId { get; init; }

    [JsonPropertyName("name")]
    public string Name { get; init; } = string.Empty;

    [JsonPropertyName("display_order")]
    public int? DisplayOrder { get; init; }
}

public sealed class MusicSourceImportSource
{
    [JsonPropertyName("category")]
    public string Category { get; init; } = string.Empty;

    [JsonPropertyName("path")]
    public IReadOnlyList<string> Path { get; init; } = Array.Empty<string>();

    [JsonPropertyName("category_uuid")]
    public string? CategoryUuid { get; init; }

    [JsonPropertyName("node_uuid")]
    public string? NodeUuid { get; init; }

    [JsonPropertyName("path_node_uuids")]
    public IReadOnlyList<string>? PathNodeUuids { get; init; }
}

public sealed class MusicSourceImportEntry
{
    [JsonPropertyName("row_key")]
    public string RowKey { get; init; } = string.Empty;

    [JsonPropertyName("song_name")]
    public string SongName { get; init; } = string.Empty;

    [JsonPropertyName("song_number")]
    public string? SongNumber { get; init; }

    [JsonPropertyName("album_name")]
    public string? AlbumName { get; init; }

    [JsonPropertyName("game_id")]
    public int GameId { get; init; }

    [JsonPropertyName("sources")]
    public IReadOnlyList<MusicSourceImportSource> Sources { get; init; } = Array.Empty<MusicSourceImportSource>();
}

public sealed class MusicSourceImportCandidate
{
    [JsonPropertyName("track_id")]
    public int TrackId { get; init; }

    [JsonPropertyName("title")]
    public string Title { get; init; } = string.Empty;
}

public sealed class MusicSourceImportPreviewResult
{
    [JsonPropertyName("summary")]
    public Dictionary<string, int> Summary { get; init; } = new();

    [JsonPropertyName("items")]
    public IReadOnlyList<Dictionary<string, object?>> Items { get; init; } = Array.Empty<Dictionary<string, object?>>();
}

public sealed class MusicSourceImportCommitResult
{
    [JsonPropertyName("summary")]
    public Dictionary<string, int> Summary { get; init; } = new();

    [JsonPropertyName("items")]
    public IReadOnlyList<Dictionary<string, object?>> Items { get; init; } = Array.Empty<Dictionary<string, object?>>();
}

public sealed class MusicSourceExportPayload
{
    [JsonPropertyName("scope")]
    public string Scope { get; init; } = "all";

    [JsonPropertyName("game_ids")]
    public IReadOnlyList<int>? GameIds { get; init; }

    [JsonPropertyName("album_ids")]
    public IReadOnlyList<int>? AlbumIds { get; init; }

    [JsonPropertyName("category_ids")]
    public IReadOnlyList<int>? CategoryIds { get; init; }
}

