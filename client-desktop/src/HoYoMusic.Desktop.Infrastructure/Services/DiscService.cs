using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using HoYoMusic.Desktop.Core.Abstractions;
using HoYoMusic.Desktop.Core.Contracts;
using HoYoMusic.Desktop.Core.Models;

namespace HoYoMusic.Desktop.Infrastructure.Services;

public sealed class DiscService : IDiscService
{
    private readonly HttpClient _httpClient;
    private readonly ITokenStore _tokenStore;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public DiscService(HttpClient httpClient, ITokenStore tokenStore)
    {
        _httpClient = httpClient;
        _tokenStore = tokenStore;
    }

    public async Task<IReadOnlyList<DiscItem>> GetDiscsByAlbumAsync(int albumId, CancellationToken cancellationToken = default)
    {
        using var response = await _httpClient.GetAsync($"albums/{albumId}/discs", cancellationToken);
        var envelope = await ReadEnvelopeAsync<DiscListEnvelopeData>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
        {
            throw new ApiException(envelope?.Error?.Message ?? "Failed to load discs.", envelope?.Error?.Code);
        }

        return envelope.Data.Discs;
    }

    public async Task<DiscItem> CreateDiscAsync(int albumId, DiscUpsertRequest request, CancellationToken cancellationToken = default)
    {
        using var authRequest = await CreateAuthenticatedRequestAsync(HttpMethod.Post, $"albums/{albumId}/discs", cancellationToken);
        authRequest.Content = JsonContent.Create(request, options: JsonOptions);
        return await SendForDiscAsync(authRequest, "Failed to create disc.", cancellationToken);
    }

    public async Task<DiscItem> UpdateDiscAsync(int discId, DiscUpsertRequest request, CancellationToken cancellationToken = default)
    {
        using var authRequest = await CreateAuthenticatedRequestAsync(HttpMethod.Put, $"discs/{discId}", cancellationToken);
        authRequest.Content = JsonContent.Create(request, options: JsonOptions);
        return await SendForDiscAsync(authRequest, "Failed to update disc.", cancellationToken);
    }

    public async Task DeleteDiscAsync(int discId, CancellationToken cancellationToken = default)
    {
        using var authRequest = await CreateAuthenticatedRequestAsync(HttpMethod.Delete, $"discs/{discId}", cancellationToken);
        await SendWithoutDataAsync(authRequest, "Failed to delete disc.", cancellationToken);
    }

    public async Task AssignTrackToDiscAsync(int trackId, int? discId, CancellationToken cancellationToken = default)
    {
        using var authRequest = await CreateAuthenticatedRequestAsync(HttpMethod.Put, $"tracks/{trackId}/disc", cancellationToken);
        authRequest.Content = JsonContent.Create(new TrackDiscAssignmentRequest { DiscId = discId }, options: JsonOptions);
        await SendWithoutDataAsync(authRequest, "Failed to assign track to disc.", cancellationToken);
    }

    public async Task BulkAssignTracksAsync(int albumId, IReadOnlyList<BulkTrackDiscAssignmentItem> assignments, CancellationToken cancellationToken = default)
    {
        using var authRequest = await CreateAuthenticatedRequestAsync(HttpMethod.Post, $"albums/{albumId}/discs/assign", cancellationToken);
        authRequest.Content = JsonContent.Create(new BulkTrackDiscAssignmentRequest { Assignments = assignments }, options: JsonOptions);
        await SendWithoutDataAsync(authRequest, "Failed to bulk assign tracks.", cancellationToken);
    }

    private async Task<DiscItem> SendForDiscAsync(HttpRequestMessage request, string fallbackError, CancellationToken cancellationToken)
    {
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var envelope = await ReadEnvelopeAsync<DiscEnvelopeData>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data?.Disc is null)
        {
            throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? fallbackError, envelope?.Error?.Code, cancellationToken);
        }

        return envelope.Data.Disc;
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

