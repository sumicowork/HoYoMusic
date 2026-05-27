using System.Net.Http.Json;
using HoYoMusic.Desktop.Core.Abstractions;
using HoYoMusic.Desktop.Core.Contracts;
using HoYoMusic.Desktop.Core.Models;

namespace HoYoMusic.Desktop.Infrastructure.Services;

public sealed class FeedbackService : HoYoApiClient, IFeedbackService
{
    public FeedbackService(HttpClient httpClient, ITokenStore tokenStore) : base(httpClient, tokenStore) { }

    public async Task SubmitAsync(string content, string? contact = null, CancellationToken ct = default)
    {
        using var response = await Http.PostAsJsonAsync("public/feedback", new { content, contact }, JsonOptions, ct);
        var envelope = await ReadEnvelopeAsync<object>(response, ct);
        if (!response.IsSuccessStatusCode || envelope?.Success != true)
            throw new ApiException(envelope?.Error?.Message ?? "Failed to submit feedback.", envelope?.Error?.Code);
    }

    public async Task<FeedbackListResult> GetAdminListAsync(int page = 1, int pageSize = 20, CancellationToken ct = default)
    {
        var query = new QueryStringBuilder()
            .Add("page", Math.Max(1, page))
            .Add("pageSize", Math.Clamp(pageSize, 1, 100))
            .ToString();
        return await GetAuthedAsync<FeedbackListResult>(HttpMethod.Get, $"admin/feedback{query}", "Failed to load feedback.", ct);
    }

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
