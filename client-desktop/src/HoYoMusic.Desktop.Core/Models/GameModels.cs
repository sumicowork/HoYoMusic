using System.Text.Json.Serialization;

namespace HoYoMusic.Desktop.Core.Models;

public sealed class GameItem
{
    [JsonPropertyName("id")]
    public int Id { get; init; }

    [JsonPropertyName("name")]
    public string Name { get; init; } = string.Empty;

    [JsonPropertyName("name_en")]
    public string? NameEn { get; init; }

    [JsonPropertyName("description")]
    public string? Description { get; init; }

    [JsonPropertyName("cover_path")]
    public string? CoverPath { get; init; }

    [JsonPropertyName("status")]
    public string? Status { get; init; }

    [JsonPropertyName("display_order")]
    public int? DisplayOrder { get; init; }

    [JsonPropertyName("album_count")]
    [JsonNumberHandling(JsonNumberHandling.AllowReadingFromString)]
    public int AlbumCount { get; init; }

    [JsonIgnore]
    public bool IsActive => string.Equals(Status, "active", StringComparison.OrdinalIgnoreCase);

    [JsonIgnore]
    public string DisplayName => string.IsNullOrWhiteSpace(NameEn) ? Name : NameEn;

    [JsonIgnore]
    public string StatusDisplay => string.Equals(Status, "maintenance", StringComparison.OrdinalIgnoreCase)
        ? "维护中"
        : string.Equals(Status, "unreleased", StringComparison.OrdinalIgnoreCase)
            ? "未上线"
            : "已上线";
}

public sealed class GameListResponseData
{
    [JsonPropertyName("games")]
    public IReadOnlyList<GameItem> Games { get; init; } = Array.Empty<GameItem>();
}

public sealed class GameAlbumItem
{
    [JsonPropertyName("id")]
    public int Id { get; init; }

    [JsonPropertyName("title")]
    public string Title { get; init; } = string.Empty;

    [JsonPropertyName("cover_path")]
    public string? CoverPath { get; init; }

    [JsonPropertyName("track_count")]
    [JsonNumberHandling(JsonNumberHandling.AllowReadingFromString)]
    public int TrackCount { get; init; }
}

public sealed class GameDetailResponseData
{
    [JsonPropertyName("albums")]
    public IReadOnlyList<GameAlbumItem> Albums { get; init; } = Array.Empty<GameAlbumItem>();
}

public sealed class GameUpsertRequest
{
    [JsonPropertyName("name")]
    public string? Name { get; init; }

    [JsonPropertyName("name_en")]
    public string? NameEn { get; init; }

    [JsonPropertyName("description")]
    public string? Description { get; init; }

    [JsonPropertyName("display_order")]
    public int? DisplayOrder { get; init; }

    [JsonPropertyName("status")]
    public string? Status { get; init; }

    [JsonPropertyName("cover_path")]
    public string? CoverPath { get; init; }
}

