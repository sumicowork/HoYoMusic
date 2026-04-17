using HoYoMusic.Desktop.Core.Models;

namespace HoYoMusic.Desktop.Core.Abstractions;

public interface IDiscService
{
    Task<IReadOnlyList<DiscItem>> GetDiscsByAlbumAsync(int albumId, CancellationToken cancellationToken = default);
    Task<DiscItem> CreateDiscAsync(int albumId, DiscUpsertRequest request, CancellationToken cancellationToken = default);
    Task<DiscItem> UpdateDiscAsync(int discId, DiscUpsertRequest request, CancellationToken cancellationToken = default);
    Task DeleteDiscAsync(int discId, CancellationToken cancellationToken = default);
    Task AssignTrackToDiscAsync(int trackId, int? discId, CancellationToken cancellationToken = default);
    Task BulkAssignTracksAsync(int albumId, IReadOnlyList<BulkTrackDiscAssignmentItem> assignments, CancellationToken cancellationToken = default);
}

