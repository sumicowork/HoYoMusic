using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
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

    public async Task<TrackFilterOptions> GetTrackFilterOptionsAsync(CancellationToken cancellationToken = default)
    {
        using var request = await CreateAuthedRequestAsync(HttpMethod.Get, "tracks/filter-options", cancellationToken);
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var envelope = await ReadEnvelopeAsync<TrackFilterOptions>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
        {
            throw new ApiException(envelope?.Error?.Message ?? "Failed to load track filter options.", envelope?.Error?.Code);
        }

        return envelope.Data;
    }

    public async Task<IReadOnlyList<SameAlbumDuplicateGroup>> GetSameAlbumDuplicateTracksAsync(CancellationToken cancellationToken = default)
    {
        using var request = await CreateAuthedRequestAsync(HttpMethod.Get, "tracks/duplicates/same-album-title", cancellationToken);
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var envelope = await ReadEnvelopeAsync<SameAlbumDuplicateResponseData>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
        {
            throw new ApiException(envelope?.Error?.Message ?? "Failed to load duplicates.", envelope?.Error?.Code);
        }

        return envelope.Data.Groups;
    }

    public async Task BulkDeleteTracksAsync(IReadOnlyCollection<int> ids, CancellationToken cancellationToken = default)
    {
        using var request = await CreateAuthedRequestAsync(HttpMethod.Delete, "tracks/bulk", cancellationToken, new { ids });
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var envelope = await ReadEnvelopeAsync<object>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true)
        {
            throw new ApiException(envelope?.Error?.Message ?? "Failed to delete tracks.", envelope?.Error?.Code);
        }
    }

    public async Task BulkMoveTracksToAlbumAsync(IReadOnlyCollection<int> trackIds, int? albumId, CancellationToken cancellationToken = default)
    {
        using var request = await CreateAuthedRequestAsync(HttpMethod.Post, "tracks/bulk-move", cancellationToken, new { trackIds, albumId });
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var envelope = await ReadEnvelopeAsync<object>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true)
        {
            throw new ApiException(envelope?.Error?.Message ?? "Failed to move tracks.", envelope?.Error?.Code);
        }
    }

    public async Task<TrackNotesImportPreviewResult> PreviewTrackNotesImportAsync(IReadOnlyList<TrackNotesImportEntry> entries, CancellationToken cancellationToken = default)
    {
        using var request = await CreateAuthedRequestAsync(HttpMethod.Post, "tracks/notes-import/preview", cancellationToken, new { entries });
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var envelope = await ReadEnvelopeAsync<TrackNotesImportPreviewResult>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
        {
            throw new ApiException(envelope?.Error?.Message ?? "Failed to preview notes import.", envelope?.Error?.Code);
        }

        return envelope.Data;
    }

    public async Task<TrackNotesImportCommitResult> CommitTrackNotesImportAsync(IReadOnlyList<TrackNotesImportEntry> entries, IReadOnlyDictionary<string, int> resolutions, string conflictMode, CancellationToken cancellationToken = default)
    {
        using var request = await CreateAuthedRequestAsync(HttpMethod.Post, "tracks/notes-import/commit", cancellationToken, new
        {
            entries,
            resolutions,
            conflict_mode = string.IsNullOrWhiteSpace(conflictMode) ? "overwrite" : conflictMode,
        });
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var envelope = await ReadEnvelopeAsync<TrackNotesImportCommitResult>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
        {
            throw new ApiException(envelope?.Error?.Message ?? "Failed to commit notes import.", envelope?.Error?.Code);
        }

        return envelope.Data;
    }

    public async Task<IReadOnlyList<TrackNotesImportCandidate>> SearchTrackNotesImportCandidatesAsync(string keyword, int limit = 30, CancellationToken cancellationToken = default)
    {
        var query = new QueryStringBuilder()
            .Add("keyword", string.IsNullOrWhiteSpace(keyword) ? null : keyword.Trim())
            .Add("limit", Math.Clamp(limit, 1, 200))
            .ToString();
        using var request = await CreateAuthedRequestAsync(HttpMethod.Get, $"tracks/notes-import/candidates{query}", cancellationToken);
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var envelope = await ReadEnvelopeAsync<TrackNotesImportCandidatesResponseData>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
        {
            throw new ApiException(envelope?.Error?.Message ?? "Failed to search notes import candidates.", envelope?.Error?.Code);
        }

        return envelope.Data.Candidates;
    }

    public async Task<BinaryFileResult> ExportAllTrackNotesAsync(CancellationToken cancellationToken = default)
    {
        using var request = await CreateAuthedRequestAsync(HttpMethod.Get, "tracks/notes-export", cancellationToken);
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        return await ReadBinaryFileResponseAsync(response, "track-notes-export.json", "Failed to export track notes.", cancellationToken);
    }

    public async Task<BinaryFileResult> ExportCatalogMetadataAsync(CancellationToken cancellationToken = default)
    {
        using var request = await CreateAuthedRequestAsync(HttpMethod.Get, "tracks/metadata-export", cancellationToken);
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        return await ReadBinaryFileResponseAsync(response, "catalog-metadata-export.json", "Failed to export catalog metadata.", cancellationToken);
    }

    public async Task<CatalogMetadataImportResult> PreviewCatalogMetadataImportByUuidAsync(CatalogMetadataImportPayload payload, CancellationToken cancellationToken = default)
    {
        using var request = await CreateAuthedRequestAsync(HttpMethod.Post, "tracks/metadata-import/preview", cancellationToken, payload);
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var envelope = await ReadEnvelopeAsync<CatalogMetadataImportResult>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
        {
            throw new ApiException(envelope?.Error?.Message ?? "Failed to preview metadata import.", envelope?.Error?.Code);
        }

        return envelope.Data;
    }

    public async Task<CatalogMetadataImportResult> CommitCatalogMetadataImportByUuidAsync(CatalogMetadataImportPayload payload, CancellationToken cancellationToken = default)
    {
        using var request = await CreateAuthedRequestAsync(HttpMethod.Post, "tracks/metadata-import/commit", cancellationToken, payload);
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var envelope = await ReadEnvelopeAsync<CatalogMetadataImportResult>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
        {
            throw new ApiException(envelope?.Error?.Message ?? "Failed to commit metadata import.", envelope?.Error?.Code);
        }

        return envelope.Data;
    }

    public async Task<CatalogMetadataRollbackResult> RollbackCatalogMetadataBatchAsync(string batchUuid, CancellationToken cancellationToken = default)
    {
        using var request = await CreateAuthedRequestAsync(HttpMethod.Post, "tracks/metadata-import/rollback", cancellationToken, new { batch_uuid = batchUuid });
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var envelope = await ReadEnvelopeAsync<CatalogMetadataRollbackResult>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
        {
            throw new ApiException(envelope?.Error?.Message ?? "Failed to rollback metadata batch.", envelope?.Error?.Code);
        }

        return envelope.Data;
    }

    private async Task<HttpRequestMessage> CreateAuthedRequestAsync<TPayload>(HttpMethod method, string uri, CancellationToken cancellationToken, TPayload payload)
    {
        var request = await CreateAuthedRequestAsync(method, uri, cancellationToken);
        request.Content = JsonContent.Create(payload, options: JsonOptions);
        return request;
    }

    private async Task<HttpRequestMessage> CreateAuthedRequestAsync(HttpMethod method, string uri, CancellationToken cancellationToken)
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

    private async Task<BinaryFileResult> ReadBinaryFileResponseAsync(HttpResponseMessage response, string fallbackFileName, string fallbackErrorMessage, CancellationToken cancellationToken)
    {
        if (!response.IsSuccessStatusCode)
        {
            var envelope = await ReadEnvelopeAsync<object>(response, cancellationToken);
            throw new ApiException(envelope?.Error?.Message ?? fallbackErrorMessage, envelope?.Error?.Code);
        }

        var bytes = await response.Content.ReadAsByteArrayAsync(cancellationToken);
        return new BinaryFileResult
        {
            Content = bytes,
            FileName = ParseFileName(response.Content.Headers.ContentDisposition?.ToString(), fallbackFileName),
            ContentType = response.Content.Headers.ContentType?.MediaType ?? "application/octet-stream",
        };
    }

    private static string ParseFileName(string? contentDisposition, string fallback)
    {
        if (string.IsNullOrWhiteSpace(contentDisposition))
        {
            return fallback;
        }

        var utf8Match = System.Text.RegularExpressions.Regex.Match(contentDisposition, "filename\\*=UTF-8''([^;]+)", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        if (utf8Match.Success)
        {
            return Uri.UnescapeDataString(utf8Match.Groups[1].Value).Trim('"');
        }

        var plainMatch = System.Text.RegularExpressions.Regex.Match(contentDisposition, "filename=\"?([^\";]+)\"?", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        return plainMatch.Success ? plainMatch.Groups[1].Value.Trim() : fallback;
    }

    private sealed class SameAlbumDuplicateResponseData
    {
        public IReadOnlyList<SameAlbumDuplicateGroup> Groups { get; init; } = Array.Empty<SameAlbumDuplicateGroup>();
    }

    private sealed class TrackNotesImportCandidatesResponseData
    {
        public IReadOnlyList<TrackNotesImportCandidate> Candidates { get; init; } = Array.Empty<TrackNotesImportCandidate>();
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
