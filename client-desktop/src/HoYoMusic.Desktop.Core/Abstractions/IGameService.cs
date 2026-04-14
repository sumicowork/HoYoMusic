using HoYoMusic.Desktop.Core.Models;

namespace HoYoMusic.Desktop.Core.Abstractions;

public interface IGameService
{
    Task<IReadOnlyList<GameItem>> GetGamesAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<GameAlbumItem>> GetGameAlbumsAsync(int gameId, CancellationToken cancellationToken = default);
}

