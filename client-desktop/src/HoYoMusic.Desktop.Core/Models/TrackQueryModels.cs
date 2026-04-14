namespace HoYoMusic.Desktop.Core.Models;

public sealed class TrackQueryOptions
{
    public string? Search { get; init; }
    public IReadOnlyCollection<int>? GameIds { get; init; }
    public string? Artist { get; init; }
    public int? YearFrom { get; init; }
    public int? YearTo { get; init; }
    public int? DurationMin { get; init; }
    public int? DurationMax { get; init; }
    public string? DurationBucket { get; init; }
    public string? LyricsStatus { get; init; }
    public bool? HasLyrics { get; init; }
    public string? SortBy { get; init; }
    public string? SortDir { get; init; }
}

public sealed class TrackPageResult
{
    public IReadOnlyList<TrackItem> Tracks { get; init; } = Array.Empty<TrackItem>();
    public TrackListPagination? Pagination { get; init; }
}

