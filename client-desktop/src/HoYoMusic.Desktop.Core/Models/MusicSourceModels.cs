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

