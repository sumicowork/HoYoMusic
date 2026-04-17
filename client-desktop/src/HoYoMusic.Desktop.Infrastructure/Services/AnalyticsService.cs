using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using HoYoMusic.Desktop.Core.Abstractions;
using HoYoMusic.Desktop.Core.Contracts;
using HoYoMusic.Desktop.Core.Models;

namespace HoYoMusic.Desktop.Infrastructure.Services;

public sealed class AnalyticsService : IAnalyticsService
{
    private readonly HttpClient _httpClient;
    private readonly ITokenStore _tokenStore;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public AnalyticsService(HttpClient httpClient, ITokenStore tokenStore)
    {
        _httpClient = httpClient;
        _tokenStore = tokenStore;
    }

    public async Task<AnalyticsOverviewItem> GetOverviewAsync(CancellationToken cancellationToken = default)
    {
        using var request = await CreateAuthenticatedRequestAsync(HttpMethod.Get, "analytics/overview", cancellationToken);
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var envelope = await ReadEnvelopeAsync<AnalyticsOverviewItem>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
        {
            throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? "Failed to load analytics overview.", envelope?.Error?.Code, cancellationToken);
        }

        return envelope.Data;
    }

    public async Task<IReadOnlyList<AnalyticsHourlyItem>> GetHourlyAsync(CancellationToken cancellationToken = default)
    {
        using var request = await CreateAuthenticatedRequestAsync(HttpMethod.Get, "analytics/hourly", cancellationToken);
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var envelope = await ReadEnvelopeAsync<IReadOnlyList<AnalyticsHourlyItem>>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
        {
            throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? "Failed to load hourly analytics.", envelope?.Error?.Code, cancellationToken);
        }

        return envelope.Data;
    }

    public async Task<IReadOnlyList<AnalyticsRecentVisitItem>> GetRecentAsync(int limit = 20, CancellationToken cancellationToken = default)
    {
        using var request = await CreateAuthenticatedRequestAsync(HttpMethod.Get, $"analytics/recent?limit={Math.Clamp(limit, 1, 200)}", cancellationToken);
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var envelope = await ReadEnvelopeAsync<IReadOnlyList<AnalyticsRecentVisitItem>>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
        {
            throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? "Failed to load recent visits.", envelope?.Error?.Code, cancellationToken);
        }

        return envelope.Data;
    }

    public async Task<IReadOnlyList<AnalyticsTopPageItem>> GetPagesAsync(int days = 7, CancellationToken cancellationToken = default)
    {
        var normalizedDays = Math.Clamp(days, 1, 90);
        using var request = await CreateAuthenticatedRequestAsync(HttpMethod.Get, $"analytics/pages?days={normalizedDays}", cancellationToken);
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var envelope = await ReadEnvelopeAsync<IReadOnlyList<AnalyticsTopPageItem>>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
        {
            throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? "Failed to load top pages analytics.", envelope?.Error?.Code, cancellationToken);
        }

        return envelope.Data;
    }

    public async Task<IReadOnlyList<AnalyticsStatusCodeItem>> GetStatusCodesAsync(int days = 7, CancellationToken cancellationToken = default)
    {
        var normalizedDays = Math.Clamp(days, 1, 90);
        using var request = await CreateAuthenticatedRequestAsync(HttpMethod.Get, $"analytics/status-codes?days={normalizedDays}", cancellationToken);
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var envelope = await ReadEnvelopeAsync<IReadOnlyList<AnalyticsStatusCodeItem>>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
        {
            throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? "Failed to load status code analytics.", envelope?.Error?.Code, cancellationToken);
        }

        return envelope.Data;
    }

    private async Task<HttpRequestMessage> CreateAuthenticatedRequestAsync(HttpMethod method, string uri, CancellationToken cancellationToken)
    {
        var token = await _tokenStore.GetTokenAsync(cancellationToken);
        if (string.IsNullOrWhiteSpace(token))
        {
            throw new ApiException("Not authenticated.", "MISSING_TOKEN");
        }

        var request = new HttpRequestMessage(method, uri);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return request;
    }

    private async Task<ApiException> CreateApiExceptionAsync(HttpStatusCode statusCode, string message, string? code, CancellationToken cancellationToken)
    {
        if (statusCode == HttpStatusCode.Unauthorized)
        {
            await _tokenStore.ClearTokenAsync(cancellationToken);
            return new ApiException("Session expired. Please login again.", "UNAUTHORIZED");
        }

        return new ApiException(message, code);
    }

    private static async Task<ApiEnvelope<TData>?> ReadEnvelopeAsync<TData>(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        try
        {
            return await response.Content.ReadFromJsonAsync<ApiEnvelope<TData>>(JsonOptions, cancellationToken);
        }
        catch (JsonException)
        {
            return null;
        }
    }
}

