using System.Text.Json.Serialization;

namespace HoYoMusic.Desktop.Core.Models;

public sealed class LyricsImportCandidate
{
    [JsonPropertyName("track_id")]
    public int TrackId { get; init; }

    [JsonPropertyName("title")]
    public string Title { get; init; } = string.Empty;

    [JsonPropertyName("album_title")]
    public string AlbumTitle { get; init; } = string.Empty;

    [JsonPropertyName("artists")]
    public string Artists { get; init; } = string.Empty;
}

public sealed class LyricsImportItem
{
    [JsonPropertyName("file_key")]
    public string FileKey { get; init; } = string.Empty;

    [JsonPropertyName("file_name")]
    public string FileName { get; init; } = string.Empty;

    [JsonPropertyName("inferred_title")]
    public string InferredTitle { get; init; } = string.Empty;

    [JsonPropertyName("status")]
    public string Status { get; init; } = string.Empty;

    [JsonPropertyName("message")]
    public string? Message { get; init; }

    [JsonPropertyName("matched_track_id")]
    public int? MatchedTrackId { get; init; }

    [JsonPropertyName("candidates")]
    public IReadOnlyList<LyricsImportCandidate> Candidates { get; init; } = Array.Empty<LyricsImportCandidate>();
}

public sealed class LyricsImportPreviewSummary
{
    [JsonPropertyName("total")]
    public int Total { get; init; }

    [JsonPropertyName("matched")]
    public int Matched { get; init; }

    [JsonPropertyName("ambiguous")]
    public int Ambiguous { get; init; }

    [JsonPropertyName("not_found")]
    public int NotFound { get; init; }

    [JsonPropertyName("invalid")]
    public int Invalid { get; init; }
}

public sealed class LyricsImportCommitSummary
{
    [JsonPropertyName("total")]
    public int Total { get; init; }

    [JsonPropertyName("imported")]
    public int Imported { get; init; }

    [JsonPropertyName("ambiguous")]
    public int Ambiguous { get; init; }

    [JsonPropertyName("not_found")]
    public int NotFound { get; init; }

    [JsonPropertyName("invalid")]
    public int Invalid { get; init; }

    [JsonPropertyName("error")]
    public int Error { get; init; }
}

public sealed class LyricsImportPreviewResult
{
    [JsonPropertyName("summary")]
    public LyricsImportPreviewSummary? Summary { get; init; }

    [JsonPropertyName("items")]
    public IReadOnlyList<LyricsImportItem> Items { get; init; } = Array.Empty<LyricsImportItem>();
}

public sealed class LyricsImportCommitResult
{
    [JsonPropertyName("summary")]
    public LyricsImportCommitSummary? Summary { get; init; }

    [JsonPropertyName("items")]
    public IReadOnlyList<LyricsImportItem> Items { get; init; } = Array.Empty<LyricsImportItem>();
}

