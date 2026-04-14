using HoYoMusic.Desktop.Core.Models;

namespace HoYoMusic.Desktop.Core.Abstractions;

public interface IDiscoverService
{
    Task<IReadOnlyList<RandomAlbumItem>> GetRandomAlbumsAsync(int count = 6, int? gameId = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<PublicTrackItem>> GetRandomTracksAsync(int count = 10, int? gameId = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<PublicTrackItem>> GetTopTracksAsync(int count = 10, int? gameId = null, CancellationToken cancellationToken = default);
}

