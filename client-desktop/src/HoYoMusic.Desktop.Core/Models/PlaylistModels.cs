using System.Text.Json.Serialization;

namespace HoYoMusic.Desktop.Core.Models;

public sealed class PlaylistItem
{
    [JsonPropertyName("id")]
    public int Id { get; init; }

    [JsonPropertyName("name")]
    public string Name { get; init; } = string.Empty;

    [JsonPropertyName("description")]
    public string? Description { get; init; }

    [JsonPropertyName("track_count")]
    public int TrackCount { get; init; }

    [JsonPropertyName("total_duration")]
    public int TotalDuration { get; init; }

    [JsonIgnore]
    public string DurationDisplay
    {
        get
        {
            if (TotalDuration <= 0)
            {
                return "--:--";
            }

            var ts = TimeSpan.FromSeconds(TotalDuration);
            return ts.TotalHours >= 1 ? ts.ToString("h\\:mm\\:ss") : ts.ToString("mm\\:ss");
        }
    }
}

public sealed class PlaylistListResponseData
{
    [JsonPropertyName("playlists")]
    public IReadOnlyList<PlaylistItem> Playlists { get; init; } = Array.Empty<PlaylistItem>();
}

public sealed class PlaylistSingleResponseData
{
    [JsonPropertyName("playlist")]
    public PlaylistItem? Playlist { get; init; }
}

public sealed class PlaylistDetailResponseData
{
    [JsonPropertyName("playlist")]
    public PlaylistItem? Playlist { get; init; }

    [JsonPropertyName("tracks")]
    public IReadOnlyList<TrackItem> Tracks { get; init; } = Array.Empty<TrackItem>();
}

public sealed class PlaylistDetailResult
{
    public PlaylistItem Playlist { get; init; } = new();
    public IReadOnlyList<TrackItem> Tracks { get; init; } = Array.Empty<TrackItem>();
}

