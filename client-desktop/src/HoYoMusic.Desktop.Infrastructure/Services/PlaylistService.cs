using System.Net.Http.Json;
using HoYoMusic.Desktop.Core.Abstractions;
using HoYoMusic.Desktop.Core.Contracts;
using HoYoMusic.Desktop.Core.Models;

namespace HoYoMusic.Desktop.Infrastructure.Services;

public sealed class PlaylistService : HoYoApiClient, IPlaylistService
{
    public PlaylistService(HttpClient httpClient, ITokenStore tokenStore) : base(httpClient, tokenStore) { }

    public async Task<IReadOnlyList<PlaylistItem>> GetPlaylistsAsync(CancellationToken ct = default)
        => (await GetAuthedAsync<ListEnvelope>(HttpMethod.Get, "playlists", "Failed to load playlists.", ct)).Playlists;

    public async Task<PlaylistDetailResult> GetPlaylistByIdAsync(int playlistId, CancellationToken ct = default)
    {
        var result = await GetAuthedAsync<DetailEnvelope>(HttpMethod.Get, $"playlists/{playlistId}", "Failed to load playlist.", ct);
        return new PlaylistDetailResult { Playlist = result.Playlist!, Tracks = result.Tracks };
    }

    public async Task<PlaylistItem> CreatePlaylistAsync(string name, string? description = null, CancellationToken ct = default)
        => (await PostFormAsync<SingleEnvelope>("playlists", new { name, description }, "Failed to create playlist.", ct)).Playlist!;

    public async Task<PlaylistItem> UpdatePlaylistAsync(int playlistId, string? name = null, string? description = null, CancellationToken ct = default)
        => (await PostFormAsync<SingleEnvelope>($"playlists/{playlistId}",
            new { name = name.NullIfWhiteSpace(), description }, "Failed to update playlist.", ct, HttpMethod.Put)).Playlist!;

    public async Task DeletePlaylistAsync(int playlistId, CancellationToken ct = default)
        => await DeleteAuthedAsync($"playlists/{playlistId}", "Failed to delete playlist.", ct);

    public async Task AddTrackAsync(int playlistId, int trackId, CancellationToken ct = default)
        => await PostVoidAsync($"playlists/{playlistId}/tracks", new { trackId }, "Failed to add track to playlist.", ct);

    public async Task RemoveTrackAsync(int playlistId, int trackId, CancellationToken ct = default)
        => await DeleteAuthedAsync($"playlists/{playlistId}/tracks/{trackId}", "Failed to remove track from playlist.", ct);

    public async Task ReorderTracksAsync(int playlistId, IReadOnlyList<int> trackIds, CancellationToken ct = default)
    {
        if (trackIds.Count == 0) return;
        await PostVoidAsync($"playlists/{playlistId}/reorder", new { trackIds }, "Failed to reorder playlist tracks.", ct);
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

    private async Task<TData> PostFormAsync<TData>(string uri, object payload, string fallbackError, CancellationToken ct, HttpMethod? method = null) where TData : class
    {
        using var authRequest = await CreateAuthedRequestAsync(method ?? HttpMethod.Post, uri, ct);
        authRequest.Content = JsonContent.Create(payload, options: JsonOptions);
        using var response = await Http.SendAsync(authRequest, ct);
        var envelope = await ReadEnvelopeAsync<TData>(response, ct);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
            throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? fallbackError, envelope?.Error?.Code, ct);
        return envelope.Data;
    }

    private async Task PostVoidAsync(string uri, object payload, string fallbackError, CancellationToken ct)
    {
        using var authRequest = await CreateAuthedRequestAsync(HttpMethod.Post, uri, ct);
        authRequest.Content = JsonContent.Create(payload, options: JsonOptions);
        await SendWithoutDataAsync(authRequest, fallbackError, ct);
    }

    private async Task DeleteAuthedAsync(string uri, string fallbackError, CancellationToken ct)
    {
        using var authRequest = await CreateAuthedRequestAsync(HttpMethod.Delete, uri, ct);
        await SendWithoutDataAsync(authRequest, fallbackError, ct);
    }

    private sealed class ListEnvelope { public IReadOnlyList<PlaylistItem> Playlists { get; init; } = Array.Empty<PlaylistItem>(); }
    private sealed class SingleEnvelope { public PlaylistItem? Playlist { get; init; } }
    private sealed class DetailEnvelope { public PlaylistItem? Playlist { get; init; } public IReadOnlyList<TrackItem> Tracks { get; init; } = Array.Empty<TrackItem>(); }
}
