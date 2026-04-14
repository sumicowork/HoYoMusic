using System.Net;
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

    public async Task<IReadOnlyList<TrackItem>> GetTracksAsync(int page = 1, int limit = 50, IReadOnlyCollection<int>? gameIds = null, CancellationToken cancellationToken = default)
    {
        var token = await _tokenStore.GetTokenAsync(cancellationToken);
        if (string.IsNullOrWhiteSpace(token))
        {
            throw new ApiException("Not authenticated.", "MISSING_TOKEN");
        }

        var query = new QueryStringBuilder()
            .Add("page", Math.Max(page, 1))
            .Add("limit", Math.Clamp(limit, 1, 100))
            .AddCsv("game_ids", gameIds)
            .ToString();

        using var request = new HttpRequestMessage(HttpMethod.Get, $"tracks{query}");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var envelope = await ReadEnvelopeAsync<TrackListResponseData>(response, cancellationToken);

        if (response.StatusCode == HttpStatusCode.Unauthorized)
        {
            await _tokenStore.ClearTokenAsync(cancellationToken);
            throw new ApiException("Session expired. Please login again.", "UNAUTHORIZED");
        }

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

    public async Task<IReadOnlyList<TrackItem>> GetPublicTracksAsync(int page = 1, int limit = 20, string? search = null, IReadOnlyCollection<int>? gameIds = null, CancellationToken cancellationToken = default)
    {
        var pageResult = await GetPublicTrackPageAsync(page, limit, new TrackQueryOptions
        {
            Search = search,
            GameIds = gameIds,
            SortBy = "release_date",
            SortDir = "DESC",
        }, cancellationToken);

        return pageResult.Tracks;
    }

    public async Task<TrackPageResult> GetPublicTrackPageAsync(int page = 1, int limit = 20, TrackQueryOptions? options = null, CancellationToken cancellationToken = default)
    {
        var query = new QueryStringBuilder()
            .Add("page", Math.Max(page, 1))
            .Add("limit", Math.Clamp(limit, 1, 100))
            .Add("search", string.IsNullOrWhiteSpace(options?.Search) ? null : options.Search.Trim())
            .AddCsv("game_ids", options?.GameIds)
            .Add("artist", string.IsNullOrWhiteSpace(options?.Artist) ? null : options.Artist.Trim())
            .Add("year_from", options?.YearFrom)
            .Add("year_to", options?.YearTo)
            .Add("duration_min", options?.DurationMin)
            .Add("duration_max", options?.DurationMax)
            .Add("duration_bucket", string.IsNullOrWhiteSpace(options?.DurationBucket) ? null : options.DurationBucket)
            .Add("lyrics_status", string.IsNullOrWhiteSpace(options?.LyricsStatus) ? null : options.LyricsStatus)
            .Add("has_lyrics", options?.HasLyrics)
            .Add("sort_by", string.IsNullOrWhiteSpace(options?.SortBy) ? "release_date" : options.SortBy)
            .Add("sort_dir", string.IsNullOrWhiteSpace(options?.SortDir) ? "DESC" : options.SortDir)
            .ToString();

        using var response = await _httpClient.GetAsync($"public/tracks{query}", cancellationToken);
        var envelope = await ReadEnvelopeAsync<TrackListResponseData>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
        {
            throw new ApiException(envelope?.Error?.Message ?? "Failed to load public tracks.", envelope?.Error?.Code);
        }

        return new TrackPageResult
        {
            Tracks = envelope.Data.Tracks,
            Pagination = envelope.Data.Pagination,
        };
    }

    public async Task<TrackItem> GetPublicTrackByIdAsync(int trackId, CancellationToken cancellationToken = default)
    {
        using var response = await _httpClient.GetAsync($"public/tracks/{trackId}", cancellationToken);
        var envelope = await ReadEnvelopeAsync<TrackResponseData>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data?.Track is null)
        {
            throw new ApiException(envelope?.Error?.Message ?? "Failed to load track detail.", envelope?.Error?.Code);
        }

        return envelope.Data.Track;
    }

    public async Task RecordPlayAsync(int trackId, int playedSeconds, int? trackDurationSeconds, string? sessionKey = null, CancellationToken cancellationToken = default)
    {
        using var response = await _httpClient.PostAsJsonAsync($"public/tracks/{trackId}/play", new
        {
            played_seconds = Math.Max(playedSeconds, 0),
            track_duration_seconds = trackDurationSeconds,
            session_key = sessionKey,
        }, JsonOptions, cancellationToken);

        if (response.IsSuccessStatusCode)
        {
            return;
        }

        var envelope = await ReadEnvelopeAsync<RecordPlayResponseData>(response, cancellationToken);
        throw new ApiException(envelope?.Error?.Message ?? "Failed to record play event.", envelope?.Error?.Code);
    }

    public Uri BuildPublicStreamUri(int trackId)
    {
        var baseUri = _httpClient.BaseAddress ?? ApiConstants.ResolveBaseUri(null);
        return new Uri(baseUri, $"public/tracks/{trackId}/stream");
    }

    public Uri BuildPublicDownloadUri(int trackId)
    {
        var baseUri = _httpClient.BaseAddress ?? ApiConstants.ResolveBaseUri(null);
        return new Uri(baseUri, $"public/tracks/{trackId}/download");
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
