using HoYoMusic.Desktop.Core.Models;

namespace HoYoMusic.Desktop.Core.Abstractions;

public interface ITrackService
{
    Task<IReadOnlyList<TrackItem>> GetTracksAsync(int page = 1, int limit = 50, IReadOnlyCollection<int>? gameIds = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<TrackItem>> GetPublicTracksAsync(int page = 1, int limit = 20, string? search = null, IReadOnlyCollection<int>? gameIds = null, CancellationToken cancellationToken = default);
    Task<TrackPageResult> GetPublicTrackPageAsync(int page = 1, int limit = 20, TrackQueryOptions? options = null, CancellationToken cancellationToken = default);
    Task<TrackItem> GetPublicTrackByIdAsync(int trackId, CancellationToken cancellationToken = default);
    Task RecordPlayAsync(int trackId, int playedSeconds, int? trackDurationSeconds, string? sessionKey = null, CancellationToken cancellationToken = default);
    Uri BuildPublicStreamUri(int trackId);
    Uri BuildPublicDownloadUri(int trackId);
}

