using HoYoMusic.Desktop.Core.Models;

namespace HoYoMusic.Desktop.Core.Abstractions;

public interface ILyricsService
{
    Task<TrackLyricsResult> GetLyricsAsync(int trackId, CancellationToken cancellationToken = default);
}

