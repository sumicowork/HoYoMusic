using System.Text.Json.Serialization;

namespace HoYoMusic.Desktop.Core.Models;

public sealed class LyricsResponseData
{
    [JsonPropertyName("lyrics")]
    public string? Lyrics { get; init; }

    [JsonPropertyName("lyrics_path")]
    public string? LyricsPath { get; init; }

    [JsonPropertyName("lyrics_status")]
    public string? LyricsStatus { get; init; }
}

public sealed class TrackLyricsResult
{
    public string Lyrics { get; init; } = string.Empty;
    public string LyricsStatus { get; init; } = string.Empty;
    public string? LyricsPath { get; init; }
}

