using System.Net.Http.Json;
using System.Text.Json;
using HoYoMusic.Desktop.Core.Abstractions;
using HoYoMusic.Desktop.Core.Contracts;
using HoYoMusic.Desktop.Core.Models;

namespace HoYoMusic.Desktop.Infrastructure.Services;

public sealed class LyricsService : ILyricsService
{
    private readonly HttpClient _httpClient;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public LyricsService(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<TrackLyricsResult> GetLyricsAsync(int trackId, CancellationToken cancellationToken = default)
    {
        using var response = await _httpClient.GetAsync($"lyrics/{trackId}/lyrics", cancellationToken);
        var envelope = await ReadEnvelopeAsync<LyricsResponseData>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
        {
            throw new ApiException(envelope?.Error?.Message ?? "Failed to load lyrics.", envelope?.Error?.Code);
        }

        return new TrackLyricsResult
        {
            Lyrics = envelope.Data.Lyrics ?? string.Empty,
            LyricsStatus = envelope.Data.LyricsStatus ?? string.Empty,
            LyricsPath = envelope.Data.LyricsPath,
        };
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

