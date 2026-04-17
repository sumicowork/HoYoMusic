using HoYoMusic.Desktop.Core.Models;

namespace HoYoMusic.Desktop.Core.Abstractions;

public interface IAnalyticsService
{
    Task<AnalyticsOverviewItem> GetOverviewAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<AnalyticsHourlyItem>> GetHourlyAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<AnalyticsRecentVisitItem>> GetRecentAsync(int limit = 20, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<AnalyticsTopPageItem>> GetPagesAsync(int days = 7, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<AnalyticsStatusCodeItem>> GetStatusCodesAsync(int days = 7, CancellationToken cancellationToken = default);
}

