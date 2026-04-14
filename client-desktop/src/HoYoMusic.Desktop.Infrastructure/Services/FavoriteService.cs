using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using HoYoMusic.Desktop.Core.Abstractions;
using HoYoMusic.Desktop.Core.Contracts;
using HoYoMusic.Desktop.Core.Models;

namespace HoYoMusic.Desktop.Infrastructure.Services;

public sealed class FavoriteService : IFavoriteService
{
    private readonly HttpClient _httpClient;
    private readonly ITokenStore _tokenStore;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public FavoriteService(HttpClient httpClient, ITokenStore tokenStore)
    {
        _httpClient = httpClient;
        _tokenStore = tokenStore;
    }

    public async Task<FavoriteToggleResult> ToggleAsync(int trackId, CancellationToken cancellationToken = default)
    {
        using var request = await CreateAuthenticatedRequestAsync(HttpMethod.Post, "favorites/toggle", cancellationToken);
        request.Content = JsonContent.Create(new { trackId });

        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var envelope = await ReadEnvelopeAsync<FavoriteToggleResponseData>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true)
        {
            throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? "Failed to toggle favorite.", envelope?.Error?.Code, cancellationToken);
        }

        return new FavoriteToggleResult { Favorited = envelope.Data?.Favorited == true };
    }

    public async Task<IReadOnlyList<TrackItem>> GetFavoritesAsync(int page = 1, int limit = 50, CancellationToken cancellationToken = default)
    {
        using var request = await CreateAuthenticatedRequestAsync(HttpMethod.Get, $"favorites?page={Math.Max(page, 1)}&limit={Math.Clamp(limit, 1, 100)}", cancellationToken);

        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var envelope = await ReadEnvelopeAsync<TrackListResponseData>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
        {
            throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? "Failed to load favorites.", envelope?.Error?.Code, cancellationToken);
        }

        return envelope.Data.Tracks;
    }

    public async Task<IReadOnlyDictionary<int, bool>> CheckFavoritesAsync(IReadOnlyList<int> trackIds, CancellationToken cancellationToken = default)
    {
        if (trackIds.Count == 0)
        {
            return new Dictionary<int, bool>();
        }

        using var request = await CreateAuthenticatedRequestAsync(HttpMethod.Post, "favorites/check", cancellationToken);
        request.Content = JsonContent.Create(new { trackIds });

        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var envelope = await ReadEnvelopeAsync<FavoriteCheckResponseData>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true)
        {
            throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? "Failed to check favorites.", envelope?.Error?.Code, cancellationToken);
        }

        return envelope.Data?.Favorites ?? new Dictionary<int, bool>();
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

