using System.Net.Http.Json;
using System.Text.Json;
using HoYoMusic.Desktop.Core.Abstractions;
using HoYoMusic.Desktop.Core.Contracts;
using HoYoMusic.Desktop.Core.Models;

namespace HoYoMusic.Desktop.Infrastructure.Services;

public sealed class DiscoverService : IDiscoverService
{
    private readonly HttpClient _httpClient;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public DiscoverService(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<IReadOnlyList<RandomAlbumItem>> GetRandomAlbumsAsync(int count = 6, int? gameId = null, CancellationToken cancellationToken = default)
    {
        var query = new QueryStringBuilder()
            .Add("count", Math.Clamp(count, 1, 20))
            .Add("game_id", gameId is > 0 ? gameId : null)
            .ToString();

        using var response = await _httpClient.GetAsync($"public/albums/random{query}", cancellationToken);
        var envelope = await ReadEnvelopeAsync<RandomAlbumResponseData>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
        {
            throw new ApiException(envelope?.Error?.Message ?? "Failed to load random albums.", envelope?.Error?.Code);
        }

        return envelope.Data.Albums;
    }

    public async Task<IReadOnlyList<PublicTrackItem>> GetRandomTracksAsync(int count = 10, int? gameId = null, CancellationToken cancellationToken = default)
    {
        var query = new QueryStringBuilder()
            .Add("count", Math.Clamp(count, 1, 30))
            .Add("game_id", gameId is > 0 ? gameId : null)
            .ToString();

        using var response = await _httpClient.GetAsync($"public/tracks/random{query}", cancellationToken);
        var envelope = await ReadEnvelopeAsync<PublicTrackListResponseData>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
        {
            throw new ApiException(envelope?.Error?.Message ?? "Failed to load random tracks.", envelope?.Error?.Code);
        }

        return envelope.Data.Tracks;
    }

    public async Task<IReadOnlyList<PublicTrackItem>> GetTopTracksAsync(int count = 10, int? gameId = null, CancellationToken cancellationToken = default)
    {
        var query = new QueryStringBuilder()
            .Add("limit", Math.Clamp(count, 1, 100))
            .Add("game_id", gameId is > 0 ? gameId : null)
            .ToString();

        using var response = await _httpClient.GetAsync($"public/top-tracks{query}", cancellationToken);
        var envelope = await ReadEnvelopeAsync<PublicTrackListResponseData>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
        {
            throw new ApiException(envelope?.Error?.Message ?? "Failed to load top tracks.", envelope?.Error?.Code);
        }

        return envelope.Data.Tracks;
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

