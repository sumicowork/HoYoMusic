using System.Net.Http.Json;
using HoYoMusic.Desktop.Core.Abstractions;
using HoYoMusic.Desktop.Core.Contracts;
using HoYoMusic.Desktop.Core.Models;

namespace HoYoMusic.Desktop.Infrastructure.Services;

public sealed class DiscService : HoYoApiClient, IDiscService
{
    public DiscService(HttpClient httpClient, ITokenStore tokenStore) : base(httpClient, tokenStore) { }

    public async Task<IReadOnlyList<DiscItem>> GetDiscsByAlbumAsync(int albumId, CancellationToken ct = default)
        => (await GetPublicAsync<DiscListEnvelope>($"albums/{albumId}/discs", "Failed to load discs.", ct)).Discs;

    public async Task<DiscItem> CreateDiscAsync(int albumId, DiscUpsertRequest request, CancellationToken ct = default)
        => (await PostFormAsync<DiscEnvelope>($"albums/{albumId}/discs", request, "Failed to create disc.", ct)).Disc!;

    public async Task<DiscItem> UpdateDiscAsync(int discId, DiscUpsertRequest request, CancellationToken ct = default)
        => (await PostFormAsync<DiscEnvelope>($"discs/{discId}", request, "Failed to update disc.", ct, HttpMethod.Put)).Disc!;

    public async Task DeleteDiscAsync(int discId, CancellationToken ct = default)
        => await DeleteAuthedAsync($"discs/{discId}", "Failed to delete disc.", ct);

    public async Task AssignTrackToDiscAsync(int trackId, int? discId, CancellationToken ct = default)
    {
        using var authRequest = await CreateAuthedRequestAsync(HttpMethod.Put, $"tracks/{trackId}/disc", ct);
        authRequest.Content = JsonContent.Create(new TrackDiscAssignmentRequest { DiscId = discId }, options: JsonOptions);
        await SendWithoutDataAsync(authRequest, "Failed to assign track to disc.", ct);
    }

    public async Task BulkAssignTracksAsync(int albumId, IReadOnlyList<BulkTrackDiscAssignmentItem> assignments, CancellationToken ct = default)
        => await PostVoidAsync($"albums/{albumId}/discs/assign", new BulkTrackDiscAssignmentRequest { Assignments = assignments }, "Failed to bulk assign tracks.", ct);

    private async Task<TData> GetPublicAsync<TData>(string uri, string fallbackError, CancellationToken ct) where TData : class
    {
        using var response = await Http.GetAsync(uri, ct);
        var envelope = await ReadEnvelopeAsync<TData>(response, ct);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
            throw new ApiException(envelope?.Error?.Message ?? fallbackError, envelope?.Error?.Code);
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
        using var authRequest = await CreateAuthedRequestAsync(HttpMethod.Put, uri, ct);
        authRequest.Content = JsonContent.Create(payload, options: JsonOptions);
        await SendWithoutDataAsync(authRequest, fallbackError, ct);
    }

    private async Task DeleteAuthedAsync(string uri, string fallbackError, CancellationToken ct)
    {
        using var authRequest = await CreateAuthedRequestAsync(HttpMethod.Delete, uri, ct);
        await SendWithoutDataAsync(authRequest, fallbackError, ct);
    }

    private sealed class DiscListEnvelope { public IReadOnlyList<DiscItem> Discs { get; init; } = Array.Empty<DiscItem>(); }
    private sealed class DiscEnvelope { public DiscItem? Disc { get; init; } }
}
