using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using HoYoMusic.Desktop.Core.Abstractions;
using HoYoMusic.Desktop.Core.Contracts;
using HoYoMusic.Desktop.Core.Models;

namespace HoYoMusic.Desktop.Infrastructure.Services;

public sealed class TrackService : ITrackService
{
    private readonly HttpClient _httpClient;
    private readonly ITokenStore _tokenStore;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public TrackService(HttpClient httpClient, ITokenStore tokenStore)
    {
        _httpClient = httpClient;
        _tokenStore = tokenStore;
    }

    public async Task<IReadOnlyList<TrackItem>> GetTracksAsync(int page = 1, int limit = 50, CancellationToken cancellationToken = default)
    {
        var token = await _tokenStore.GetTokenAsync(cancellationToken);
        if (string.IsNullOrWhiteSpace(token))
        {
            throw new ApiException("Not authenticated.", "MISSING_TOKEN");
        }

        using var request = new HttpRequestMessage(HttpMethod.Get, $"tracks?page={page}&limit={limit}");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var envelope = await response.Content.ReadFromJsonAsync<ApiEnvelope<TrackListResponseData>>(JsonOptions, cancellationToken);

        if (envelope is null)
        {
            throw new ApiException("Failed to parse track list response.");
        }

        if (!response.IsSuccessStatusCode || !envelope.Success || envelope.Data is null)
        {
            var message = envelope.Error?.Message ?? "Failed to load tracks.";
            throw new ApiException(message, envelope.Error?.Code);
        }

        return envelope.Data.Tracks;
    }

    public Uri BuildPublicStreamUri(int trackId)
    {
        return new Uri(ApiConstants.ApiBaseUri, $"public/tracks/{trackId}/stream");
    }
}

