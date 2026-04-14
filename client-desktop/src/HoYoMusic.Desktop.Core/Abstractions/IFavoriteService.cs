using HoYoMusic.Desktop.Core.Models;

namespace HoYoMusic.Desktop.Core.Abstractions;

public interface IFavoriteService
{
    Task<FavoriteToggleResult> ToggleAsync(int trackId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<TrackItem>> GetFavoritesAsync(int page = 1, int limit = 50, CancellationToken cancellationToken = default);
    Task<IReadOnlyDictionary<int, bool>> CheckFavoritesAsync(IReadOnlyList<int> trackIds, CancellationToken cancellationToken = default);
}

