using System.Net.Http.Json;
using HoYoMusic.Desktop.Core.Abstractions;
using HoYoMusic.Desktop.Core.Contracts;
using HoYoMusic.Desktop.Core.Models;

namespace HoYoMusic.Desktop.Infrastructure.Services;

public sealed class AnalyticsService : HoYoApiClient, IAnalyticsService
{
    public AnalyticsService(HttpClient httpClient, ITokenStore tokenStore) : base(httpClient, tokenStore) { }

    public async Task<AnalyticsOverviewItem> GetOverviewAsync(CancellationToken ct = default)
        => await GetAuthedAsync<AnalyticsOverviewItem>(HttpMethod.Get, "analytics/overview", "Failed to load analytics overview.", ct);

    public async Task<IReadOnlyList<AnalyticsHourlyItem>> GetHourlyAsync(CancellationToken ct = default)
        => await GetAuthedAsync<IReadOnlyList<AnalyticsHourlyItem>>(HttpMethod.Get, "analytics/hourly", "Failed to load hourly analytics.", ct);

    public async Task<IReadOnlyList<AnalyticsRecentVisitItem>> GetRecentAsync(int limit = 20, CancellationToken ct = default)
        => await GetAuthedAsync<IReadOnlyList<AnalyticsRecentVisitItem>>(HttpMethod.Get, $"analytics/recent?limit={Math.Clamp(limit, 1, 200)}", "Failed to load recent visits.", ct);

    public async Task<IReadOnlyList<AnalyticsTopPageItem>> GetPagesAsync(int days = 7, CancellationToken ct = default)
        => await GetAuthedAsync<IReadOnlyList<AnalyticsTopPageItem>>(HttpMethod.Get, $"analytics/pages?days={Math.Clamp(days, 1, 90)}", "Failed to load top pages analytics.", ct);

    public async Task<IReadOnlyList<AnalyticsStatusCodeItem>> GetStatusCodesAsync(int days = 7, CancellationToken ct = default)
        => await GetAuthedAsync<IReadOnlyList<AnalyticsStatusCodeItem>>(HttpMethod.Get, $"analytics/status-codes?days={Math.Clamp(days, 1, 90)}", "Failed to load status code analytics.", ct);

    private async Task<TData> GetAuthedAsync<TData>(HttpMethod method, string uri, string fallbackError, CancellationToken ct) where TData : class
    {
        using var request = await CreateAuthedRequestAsync(method, uri, ct);
        using var response = await Http.SendAsync(request, ct);
        var envelope = await ReadEnvelopeAsync<TData>(response, ct);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
            throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? fallbackError, envelope?.Error?.Code, ct);
        return envelope.Data;
    }
}
