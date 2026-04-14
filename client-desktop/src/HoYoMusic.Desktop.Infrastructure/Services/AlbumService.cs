using System.Net.Http.Json;
using System.Text.Json;
using HoYoMusic.Desktop.Core.Abstractions;
using HoYoMusic.Desktop.Core.Contracts;
using HoYoMusic.Desktop.Core.Models;

namespace HoYoMusic.Desktop.Infrastructure.Services;

public sealed class AlbumService : IAlbumService
{
    private readonly HttpClient _httpClient;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public AlbumService(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<AlbumDetailResult> GetAlbumByIdAsync(int albumId, CancellationToken cancellationToken = default)
    {
        using var response = await _httpClient.GetAsync($"albums/{albumId}", cancellationToken);
        var envelope = await ReadEnvelopeAsync<AlbumDetailResponseData>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data?.Album is null)
        {
            throw new ApiException(envelope?.Error?.Message ?? "Failed to load album details.", envelope?.Error?.Code);
        }

        return new AlbumDetailResult
        {
            Album = envelope.Data.Album,
            Tracks = envelope.Data.Tracks,
            Discs = envelope.Data.Discs,
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

