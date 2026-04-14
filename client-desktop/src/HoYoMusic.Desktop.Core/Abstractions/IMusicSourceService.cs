using HoYoMusic.Desktop.Core.Models;

namespace HoYoMusic.Desktop.Core.Abstractions;

public interface IMusicSourceService
{
    Task<IReadOnlyList<TrackMusicSourceItem>> GetTrackMusicSourcesAsync(int trackId, CancellationToken cancellationToken = default);
}

