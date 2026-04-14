using HoYoMusic.Desktop.Core.Models;

namespace HoYoMusic.Desktop.Core.Abstractions;

public interface IAlbumService
{
    Task<AlbumDetailResult> GetAlbumByIdAsync(int albumId, CancellationToken cancellationToken = default);
}

