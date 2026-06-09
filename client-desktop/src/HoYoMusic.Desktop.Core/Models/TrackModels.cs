using System.Text.Json.Serialization;

namespace HoYoMusic.Desktop.Core.Models;

public sealed class TrackArtist
{
    [JsonPropertyName("id")]
    public int? Id { get; init; }

    [JsonPropertyName("name")]
    public string Name { get; init; } = string.Empty;
}

public sealed class TrackItem
{
    [JsonPropertyName("id")]
    public int Id { get; init; }

    [JsonPropertyName("title")]
    public string Title { get; init; } = string.Empty;

    [JsonPropertyName("album_title")]
    public string? AlbumTitle { get; init; }

    [JsonPropertyName("duration")]
    public int? Duration { get; init; }

    [JsonPropertyName("cover_path")]
    public string? CoverPath { get; init; }

    [JsonPropertyName("artists")]
    public IReadOnlyList<TrackArtist> Artists { get; init; } = Array.Empty<TrackArtist>();

    [JsonIgnore]
    public string ArtistsDisplay => Artists.Count == 0 ? "Unknown artist" : string.Join(" / ", Artists.Select(artist => artist.Name));

    [JsonIgnore]
    public string DurationDisplay
    {
        get
        {
            if (Duration is null || Duration <= 0)
            {
                return "--:--";
            }

            var ts = TimeSpan.FromSeconds(Duration.Value);
            return ts.TotalHours >= 1 ? ts.ToString("h\\:mm\\:ss") : ts.ToString("mm\\:ss");
        }
    }
}

public sealed class TrackListPagination
{
    [JsonPropertyName("page")]
    public int Page { get; init; }

    [JsonPropertyName("limit")]
    public int Limit { get; init; }

    [JsonPropertyName("total")]
    public int Total { get; init; }

    [JsonPropertyName("totalPages")]
    public int TotalPages { get; init; }
}

public sealed class TrackListResponseData
{
    [JsonPropertyName("tracks")]
    public IReadOnlyList<TrackItem> Tracks { get; init; } = Array.Empty<TrackItem>();

    [JsonPropertyName("pagination")]
    public TrackListPagination? Pagination { get; init; }
}

public sealed class TrackResponseData
{
    [JsonPropertyName("track")]
    public TrackItem? Track { get; init; }
}

public sealed class RecordPlayResponseData
{
    [JsonPropertyName("effective_play")]
    public bool EffectivePlay { get; init; }
}

