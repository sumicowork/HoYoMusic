using HoYoMusic.Desktop.Core.Models;

namespace HoYoMusic.Desktop.Core.Abstractions;

public interface ICreditsService
{
    Task<IReadOnlyList<CreditItem>> GetCreditsAsync(int trackId, CancellationToken cancellationToken = default);
}

