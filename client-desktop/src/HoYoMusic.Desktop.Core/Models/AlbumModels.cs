using System.Text.Json.Serialization;

namespace HoYoMusic.Desktop.Core.Models;

public sealed class AlbumItem
{
    [JsonPropertyName("id")]
    public int Id { get; init; }

    [JsonPropertyName("title")]
    public string Title { get; init; } = string.Empty;

    [JsonPropertyName("title_cn")]
    public string? TitleCn { get; init; }

    [JsonPropertyName("title_en")]
    public string? TitleEn { get; init; }

    [JsonPropertyName("cover_path")]
    public string? CoverPath { get; init; }

    [JsonPropertyName("release_date")]
    public string? ReleaseDate { get; init; }

    [JsonPropertyName("track_count")]
    [JsonNumberHandling(JsonNumberHandling.AllowReadingFromString)]
    public int TrackCount { get; init; }

    [JsonPropertyName("total_duration")]
    [JsonNumberHandling(JsonNumberHandling.AllowReadingFromString)]
    public int TotalDuration { get; init; }

    [JsonPropertyName("notes")]
    public string? Notes { get; init; }
}

public sealed class AlbumDiscItem
{
    [JsonPropertyName("id")]
    public int Id { get; init; }

    [JsonPropertyName("disc_number")]
    public int? DiscNumber { get; init; }

    [JsonPropertyName("disc_title")]
    public string? DiscTitle { get; init; }
}

public sealed class AlbumDetailResponseData
{
    [JsonPropertyName("album")]
    public AlbumItem? Album { get; init; }

    [JsonPropertyName("tracks")]
    public IReadOnlyList<TrackItem> Tracks { get; init; } = Array.Empty<TrackItem>();

    [JsonPropertyName("discs")]
    public IReadOnlyList<AlbumDiscItem> Discs { get; init; } = Array.Empty<AlbumDiscItem>();
}

public sealed class AlbumDetailResult
{
    public AlbumItem Album { get; init; } = new();
    public IReadOnlyList<TrackItem> Tracks { get; init; } = Array.Empty<TrackItem>();
    public IReadOnlyList<AlbumDiscItem> Discs { get; init; } = Array.Empty<AlbumDiscItem>();
}

