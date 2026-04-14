using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using HoYoMusic.Desktop.Core.Abstractions;
using HoYoMusic.Desktop.Core.Contracts;
using HoYoMusic.Desktop.Core.Models;

namespace HoYoMusic.Desktop.Infrastructure.Services;

public sealed class PlaylistService : IPlaylistService
{
    private readonly HttpClient _httpClient;
    private readonly ITokenStore _tokenStore;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public PlaylistService(HttpClient httpClient, ITokenStore tokenStore)
    {
        _httpClient = httpClient;
        _tokenStore = tokenStore;
    }

    public async Task<IReadOnlyList<PlaylistItem>> GetPlaylistsAsync(CancellationToken cancellationToken = default)
    {
        using var request = await CreateAuthenticatedRequestAsync(HttpMethod.Get, "playlists", cancellationToken);
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var envelope = await ReadEnvelopeAsync<PlaylistListResponseData>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
        {
            throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? "Failed to load playlists.", envelope?.Error?.Code, cancellationToken);
        }

        return envelope.Data.Playlists;
    }

    public async Task<PlaylistDetailResult> GetPlaylistByIdAsync(int playlistId, CancellationToken cancellationToken = default)
    {
        using var request = await CreateAuthenticatedRequestAsync(HttpMethod.Get, $"playlists/{playlistId}", cancellationToken);
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var envelope = await ReadEnvelopeAsync<PlaylistDetailResponseData>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data?.Playlist is null)
        {
            throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? "Failed to load playlist.", envelope?.Error?.Code, cancellationToken);
        }

        return new PlaylistDetailResult
        {
            Playlist = envelope.Data.Playlist,
            Tracks = envelope.Data.Tracks,
        };
    }

    public async Task<PlaylistItem> CreatePlaylistAsync(string name, string? description = null, CancellationToken cancellationToken = default)
    {
        using var request = await CreateAuthenticatedRequestAsync(HttpMethod.Post, "playlists", cancellationToken);
        request.Content = JsonContent.Create(new { name, description });

        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var envelope = await ReadEnvelopeAsync<PlaylistSingleResponseData>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data?.Playlist is null)
        {
            throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? "Failed to create playlist.", envelope?.Error?.Code, cancellationToken);
        }

        return envelope.Data.Playlist;
    }

    public async Task<PlaylistItem> UpdatePlaylistAsync(int playlistId, string? name = null, string? description = null, CancellationToken cancellationToken = default)
    {
        using var request = await CreateAuthenticatedRequestAsync(HttpMethod.Put, $"playlists/{playlistId}", cancellationToken);
        request.Content = JsonContent.Create(new
        {
            name = string.IsNullOrWhiteSpace(name) ? null : name.Trim(),
            description,
        });

        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var envelope = await ReadEnvelopeAsync<PlaylistSingleResponseData>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data?.Playlist is null)
        {
            throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? "Failed to update playlist.", envelope?.Error?.Code, cancellationToken);
        }

        return envelope.Data.Playlist;
    }

    public async Task DeletePlaylistAsync(int playlistId, CancellationToken cancellationToken = default)
    {
        using var request = await CreateAuthenticatedRequestAsync(HttpMethod.Delete, $"playlists/{playlistId}", cancellationToken);
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var envelope = await ReadEnvelopeAsync<object>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true)
        {
            throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? "Failed to delete playlist.", envelope?.Error?.Code, cancellationToken);
        }
    }

    public async Task AddTrackAsync(int playlistId, int trackId, CancellationToken cancellationToken = default)
    {
        using var request = await CreateAuthenticatedRequestAsync(HttpMethod.Post, $"playlists/{playlistId}/tracks", cancellationToken);
        request.Content = JsonContent.Create(new { trackId });
        await SendWithoutDataAsync(request, "Failed to add track to playlist.", cancellationToken);
    }

    public async Task RemoveTrackAsync(int playlistId, int trackId, CancellationToken cancellationToken = default)
    {
        using var request = await CreateAuthenticatedRequestAsync(HttpMethod.Delete, $"playlists/{playlistId}/tracks/{trackId}", cancellationToken);
        await SendWithoutDataAsync(request, "Failed to remove track from playlist.", cancellationToken);
    }

    public async Task ReorderTracksAsync(int playlistId, IReadOnlyList<int> trackIds, CancellationToken cancellationToken = default)
    {
        if (trackIds.Count == 0)
        {
            return;
        }

        using var request = await CreateAuthenticatedRequestAsync(HttpMethod.Put, $"playlists/{playlistId}/reorder", cancellationToken);
        request.Content = JsonContent.Create(new
        {
            trackIds = trackIds.ToArray(),
        });

        await SendWithoutDataAsync(request, "Failed to reorder playlist tracks.", cancellationToken);
    }

    private async Task SendWithoutDataAsync(HttpRequestMessage request, string fallbackError, CancellationToken cancellationToken)
    {
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var envelope = await ReadEnvelopeAsync<object>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true)
        {
            throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? fallbackError, envelope?.Error?.Code, cancellationToken);
        }
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

