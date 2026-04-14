using System.Net.Http.Json;
using System.Text.Json;
using HoYoMusic.Desktop.Core.Abstractions;
using HoYoMusic.Desktop.Core.Contracts;
using HoYoMusic.Desktop.Core.Models;

namespace HoYoMusic.Desktop.Infrastructure.Services;

public sealed class MusicSourceService : IMusicSourceService
{
    private readonly HttpClient _httpClient;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public MusicSourceService(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<IReadOnlyList<TrackMusicSourceItem>> GetTrackMusicSourcesAsync(int trackId, CancellationToken cancellationToken = default)
    {
        using var response = await _httpClient.GetAsync($"public/tracks/{trackId}/music-sources", cancellationToken);
        var envelope = await ReadEnvelopeAsync<TrackMusicSourceResponseData>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
        {
            throw new ApiException(envelope?.Error?.Message ?? "Failed to load music sources.", envelope?.Error?.Code);
        }

        return envelope.Data.Items;
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

