using System.Text.Json.Serialization;

namespace HoYoMusic.Desktop.Core.Models;

public sealed class RandomAlbumItem
{
    [JsonPropertyName("id")]
    public int Id { get; init; }

    [JsonPropertyName("title")]
    public string Title { get; init; } = string.Empty;

    [JsonPropertyName("cover_path")]
    public string? CoverPath { get; init; }

    [JsonPropertyName("track_count")]
    public int TrackCount { get; init; }

    [JsonPropertyName("game_name")]
    public string? GameName { get; init; }
}

public sealed class PublicTrackItem
{
    [JsonPropertyName("id")]
    public int Id { get; init; }

    [JsonPropertyName("title")]
    public string Title { get; init; } = string.Empty;

    [JsonPropertyName("album_title")]
    public string? AlbumTitle { get; init; }

    [JsonPropertyName("duration")]
    public int? Duration { get; init; }

    [JsonPropertyName("play_count")]
    public int? PlayCount { get; init; }

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

public sealed class RandomAlbumResponseData
{
    [JsonPropertyName("albums")]
    public IReadOnlyList<RandomAlbumItem> Albums { get; init; } = Array.Empty<RandomAlbumItem>();
}

public sealed class PublicTrackListResponseData
{
    [JsonPropertyName("tracks")]
    public IReadOnlyList<PublicTrackItem> Tracks { get; init; } = Array.Empty<PublicTrackItem>();
}

