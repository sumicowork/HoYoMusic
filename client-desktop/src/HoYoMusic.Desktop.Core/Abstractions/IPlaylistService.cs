using HoYoMusic.Desktop.Core.Models;

namespace HoYoMusic.Desktop.Core.Abstractions;

public interface IPlaylistService
{
    Task<IReadOnlyList<PlaylistItem>> GetPlaylistsAsync(CancellationToken cancellationToken = default);
    Task<PlaylistDetailResult> GetPlaylistByIdAsync(int playlistId, CancellationToken cancellationToken = default);
    Task<PlaylistItem> CreatePlaylistAsync(string name, string? description = null, CancellationToken cancellationToken = default);
    Task<PlaylistItem> UpdatePlaylistAsync(int playlistId, string? name = null, string? description = null, CancellationToken cancellationToken = default);
    Task DeletePlaylistAsync(int playlistId, CancellationToken cancellationToken = default);
    Task AddTrackAsync(int playlistId, int trackId, CancellationToken cancellationToken = default);
    Task RemoveTrackAsync(int playlistId, int trackId, CancellationToken cancellationToken = default);
    Task ReorderTracksAsync(int playlistId, IReadOnlyList<int> trackIds, CancellationToken cancellationToken = default);
}

