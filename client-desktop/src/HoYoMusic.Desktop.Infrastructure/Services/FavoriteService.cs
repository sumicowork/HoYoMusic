using System.Net.Http.Json;
using HoYoMusic.Desktop.Core.Abstractions;
using HoYoMusic.Desktop.Core.Contracts;
using HoYoMusic.Desktop.Core.Models;

namespace HoYoMusic.Desktop.Infrastructure.Services;

public sealed class FavoriteService : HoYoApiClient, IFavoriteService
{
    public FavoriteService(HttpClient httpClient, ITokenStore tokenStore) : base(httpClient, tokenStore) { }

    public async Task<FavoriteToggleResult> ToggleAsync(int trackId, CancellationToken ct = default)
    {
        using var request = await CreateAuthedRequestAsync(HttpMethod.Post, $"favorites/toggle/{trackId}", ct);
        using var response = await Http.SendAsync(request, ct);
        var envelope = await ReadEnvelopeAsync<FavoriteToggleResult>(response, ct);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
            throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? "Failed to toggle favorite.", envelope?.Error?.Code, ct);
        return envelope.Data;
    }

    public async Task<IReadOnlyList<TrackItem>> GetFavoritesAsync(int page = 1, int limit = 50, CancellationToken ct = default)
    {
        var query = new QueryStringBuilder()
            .Add("page", Math.Max(1, page))
            .Add("limit", Math.Clamp(limit, 1, 100))
            .ToString();
        return await GetAuthedAsync<IReadOnlyList<TrackItem>>(HttpMethod.Get, $"favorites{query}", "Failed to load favorites.", ct);
    }

    public async Task<IReadOnlyDictionary<int, bool>> CheckFavoritesAsync(IReadOnlyList<int> trackIds, CancellationToken ct = default)
    {
        if (trackIds.Count == 0) return new Dictionary<int, bool>();

        using var request = await CreateAuthedRequestAsync(HttpMethod.Post, "favorites/check", ct);
        request.Content = JsonContent.Create(new { track_ids = trackIds }, options: JsonOptions);
        using var response = await Http.SendAsync(request, ct);
        var envelope = await ReadEnvelopeAsync<Dictionary<int, bool>>(response, ct);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
            throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? "Failed to check favorites.", envelope?.Error?.Code, ct);
        return envelope.Data;
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
