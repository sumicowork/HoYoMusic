using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using HoYoMusic.Desktop.Core.Abstractions;
using HoYoMusic.Desktop.Core.Contracts;
using HoYoMusic.Desktop.Core.Models;

namespace HoYoMusic.Desktop.Infrastructure.Services;

public sealed class TrackService : HoYoApiClient, ITrackService
{
    public TrackService(HttpClient httpClient, ITokenStore tokenStore) : base(httpClient, tokenStore) { }

    public async Task<IReadOnlyList<TrackItem>> GetTracksAsync(int page = 1, int limit = 50, IReadOnlyCollection<int>? gameIds = null, CancellationToken ct = default)
    {
        var query = new QueryStringBuilder()
            .Add("page", Math.Max(page, 1))
            .Add("limit", Math.Clamp(limit, 1, 100))
            .AddCsv("game_ids", gameIds)
            .ToString();

        using var request = await CreateAuthedRequestAsync(HttpMethod.Get, $"tracks{query}", ct);
        using var response = await Http.SendAsync(request, ct);
        var envelope = await ReadEnvelopeAsync<TrackListResponseData>(response, ct);

        if (response.StatusCode == HttpStatusCode.Unauthorized)
        {
            await TokenStore.ClearTokenAsync(ct);
            throw new ApiException("Session expired. Please login again.", "UNAUTHORIZED");
        }

        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
            throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? "Failed to load tracks.", envelope?.Error?.Code, ct);

        return envelope.Data.Tracks;
    }

    public async Task<IReadOnlyList<TrackItem>> GetPublicTracksAsync(int page = 1, int limit = 20, string? search = null, IReadOnlyCollection<int>? gameIds = null, CancellationToken ct = default)
    {
        var pageResult = await GetPublicTrackPageAsync(page, limit, new TrackQueryOptions
        {
            Search = search, GameIds = gameIds,
            SortBy = "release_date", SortDir = "DESC",
        }, ct);
        return pageResult.Tracks;
    }

    public async Task<TrackPageResult> GetPublicTrackPageAsync(int page = 1, int limit = 20, TrackQueryOptions? options = null, CancellationToken ct = default)
    {
        var query = new QueryStringBuilder()
            .Add("page", Math.Max(page, 1))
            .Add("limit", Math.Clamp(limit, 1, 100))
            .Add("search", options?.Search.NullIfWhiteSpace())
            .AddCsv("game_ids", options?.GameIds)
            .Add("artist", options?.Artist.NullIfWhiteSpace())
            .Add("year_from", options?.YearFrom)
            .Add("year_to", options?.YearTo)
            .Add("duration_min", options?.DurationMin)
            .Add("duration_max", options?.DurationMax)
            .Add("duration_bucket", options?.DurationBucket.NullIfWhiteSpace())
            .Add("lyrics_status", options?.LyricsStatus.NullIfWhiteSpace())
            .Add("has_lyrics", options?.HasLyrics)
            .Add("sort_by", options?.SortBy.NullIfWhiteSpace() ?? "release_date")
            .Add("sort_dir", options?.SortDir.NullIfWhiteSpace() ?? "DESC")
            .ToString();

        using var response = await Http.GetAsync($"public/tracks{query}", ct);
        var envelope = await ReadEnvelopeAsync<TrackListResponseData>(response, ct);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
            throw new ApiException(envelope?.Error?.Message ?? "Failed to load public tracks.", envelope?.Error?.Code);

        return new TrackPageResult { Tracks = envelope.Data.Tracks, Pagination = envelope.Data.Pagination };
    }

    public async Task<TrackItem> GetPublicTrackByIdAsync(int trackId, CancellationToken ct = default)
    {
        using var response = await Http.GetAsync($"public/tracks/{trackId}", ct);
        var envelope = await ReadEnvelopeAsync<TrackResponseData>(response, ct);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data?.Track is null)
            throw new ApiException(envelope?.Error?.Message ?? "Failed to load track detail.", envelope?.Error?.Code);

        return envelope.Data.Track;
    }

    public async Task RecordPlayAsync(int trackId, int playedSeconds, int? trackDurationSeconds, string? sessionKey = null, CancellationToken ct = default)
    {
        using var response = await Http.PostAsJsonAsync($"public/tracks/{trackId}/play", new
        {
            played_seconds = Math.Max(playedSeconds, 0),
            track_duration_seconds = trackDurationSeconds,
            session_key = sessionKey,
        }, JsonOptions, ct);

        if (response.IsSuccessStatusCode) return;

        var envelope = await ReadEnvelopeAsync<object>(response, ct);
        throw new ApiException(envelope?.Error?.Message ?? "Failed to record play event.", envelope?.Error?.Code);
    }

    public Uri BuildPublicStreamUri(int trackId) => BuildUri($"public/tracks/{trackId}/stream");
    public Uri BuildPublicDownloadUri(int trackId) => BuildUri($"public/tracks/{trackId}/download");

    private Uri BuildUri(string relative)
    {
        var baseUri = Http.BaseAddress ?? ApiConstants.ResolveBaseUri(null);
        return new Uri(baseUri, relative);
    }

    public async Task<TrackFilterOptions> GetTrackFilterOptionsAsync(CancellationToken ct = default)
    {
        using var request = await CreateAuthedRequestAsync(HttpMethod.Get, "tracks/filter-options", ct);
        using var response = await Http.SendAsync(request, ct);
        var envelope = await ReadEnvelopeAsync<TrackFilterOptions>(response, ct);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
            throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? "Failed to load track filter options.", envelope?.Error?.Code, ct);
        return envelope.Data;
    }

    public async Task<IReadOnlyList<SameAlbumDuplicateGroup>> GetSameAlbumDuplicateTracksAsync(CancellationToken ct = default)
    {
        var result = await GetAuthedEnvelopeAsync<SameAlbumDuplicateResponseData>(HttpMethod.Get, "tracks/duplicates/same-album-title", "Failed to load duplicates.", ct);
        return result.Groups;
    }

    public async Task BulkDeleteTracksAsync(IReadOnlyCollection<int> ids, CancellationToken ct = default)
    {
        using var request = await CreateAuthedRequestAsync(HttpMethod.Delete, "tracks/bulk", ct, new { ids });
        await SendWithoutDataAsync(request, "Failed to delete tracks.", ct);
    }

    public async Task BulkMoveTracksToAlbumAsync(IReadOnlyCollection<int> trackIds, int? albumId, CancellationToken ct = default)
    {
        using var request = await CreateAuthedRequestAsync(HttpMethod.Post, "tracks/bulk-move", ct, new { trackIds, albumId });
        await SendWithoutDataAsync(request, "Failed to move tracks.", ct);
    }

    public async Task<TrackNotesImportPreviewResult> PreviewTrackNotesImportAsync(IReadOnlyList<TrackNotesImportEntry> entries, CancellationToken ct = default)
    {
        return await PostAuthedEnvelopeAsync<TrackNotesImportPreviewResult>("tracks/notes-import/preview", new { entries }, "Failed to preview notes import.", ct);
    }

    public async Task<TrackNotesImportCommitResult> CommitTrackNotesImportAsync(IReadOnlyList<TrackNotesImportEntry> entries, IReadOnlyDictionary<string, int> resolutions, string conflictMode, CancellationToken ct = default)
    {
        return await PostAuthedEnvelopeAsync<TrackNotesImportCommitResult>("tracks/notes-import/commit", new
        {
            entries, resolutions,
            conflict_mode = string.IsNullOrWhiteSpace(conflictMode) ? "overwrite" : conflictMode,
        }, "Failed to commit notes import.", ct);
    }

    public async Task<IReadOnlyList<TrackNotesImportCandidate>> SearchTrackNotesImportCandidatesAsync(string keyword, int limit = 30, CancellationToken ct = default)
    {
        var query = new QueryStringBuilder()
            .Add("keyword", keyword.NullIfWhiteSpace())
            .Add("limit", Math.Clamp(limit, 1, 200))
            .ToString();
        var result = await GetAuthedEnvelopeAsync<TrackNotesImportCandidatesResponseData>(HttpMethod.Get, $"tracks/notes-import/candidates{query}", "Failed to search notes import candidates.", ct);
        return result.Candidates;
    }

    public async Task<BinaryFileResult> ExportAllTrackNotesAsync(CancellationToken ct = default)
    {
        using var request = await CreateAuthedRequestAsync(HttpMethod.Get, "tracks/notes-export", ct);
        using var response = await Http.SendAsync(request, ct);
        return await ReadBinaryFileResponseAsync(response, "track-notes-export.json", "Failed to export track notes.", ct);
    }

    public async Task<BinaryFileResult> ExportCatalogMetadataAsync(CancellationToken ct = default)
    {
        using var request = await CreateAuthedRequestAsync(HttpMethod.Get, "tracks/metadata-export", ct);
        using var response = await Http.SendAsync(request, ct);
        return await ReadBinaryFileResponseAsync(response, "catalog-metadata-export.json", "Failed to export catalog metadata.", ct);
    }

    public async Task<CatalogMetadataImportResult> PreviewCatalogMetadataImportByUuidAsync(CatalogMetadataImportPayload payload, CancellationToken ct = default)
        => await PostAuthedEnvelopeAsync<CatalogMetadataImportResult>("tracks/metadata-import/preview", payload, "Failed to preview metadata import.", ct);

    public async Task<CatalogMetadataImportResult> CommitCatalogMetadataImportByUuidAsync(CatalogMetadataImportPayload payload, CancellationToken ct = default)
        => await PostAuthedEnvelopeAsync<CatalogMetadataImportResult>("tracks/metadata-import/commit", payload, "Failed to commit metadata import.", ct);

    public async Task<CatalogMetadataRollbackResult> RollbackCatalogMetadataBatchAsync(string batchUuid, CancellationToken ct = default)
        => await PostAuthedEnvelopeAsync<CatalogMetadataRollbackResult>("tracks/metadata-import/rollback", new { batch_uuid = batchUuid }, "Failed to rollback metadata batch.", ct);

    private async Task<TData> GetAuthedEnvelopeAsync<TData>(HttpMethod method, string uri, string fallbackError, CancellationToken ct) where TData : class
    {
        using var request = await CreateAuthedRequestAsync(method, uri, ct);
        using var response = await Http.SendAsync(request, ct);
        var envelope = await ReadEnvelopeAsync<TData>(response, ct);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
            throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? fallbackError, envelope?.Error?.Code, ct);
        return envelope.Data;
    }

    private async Task<TData> PostAuthedEnvelopeAsync<TData>(string uri, object payload, string fallbackError, CancellationToken ct) where TData : class
    {
        using var request = await CreateAuthedRequestAsync(HttpMethod.Post, uri, ct, payload);
        using var response = await Http.SendAsync(request, ct);
        var envelope = await ReadEnvelopeAsync<TData>(response, ct);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
            throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? fallbackError, envelope?.Error?.Code, ct);
        return envelope.Data;
    }

    private async Task<BinaryFileResult> ReadBinaryFileResponseAsync(HttpResponseMessage response, string fallbackFileName, string fallbackError, CancellationToken ct)
    {
        if (!response.IsSuccessStatusCode)
        {
            var envelope = await ReadEnvelopeAsync<object>(response, ct);
            throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? fallbackError, envelope?.Error?.Code, ct);
        }

        var bytes = await response.Content.ReadAsByteArrayAsync(ct);
        return new BinaryFileResult
        {
            Content = bytes,
            FileName = ParseFileName(response.Content.Headers.ContentDisposition?.ToString(), fallbackFileName),
            ContentType = response.Content.Headers.ContentType?.MediaType ?? "application/octet-stream",
        };
    }

    private static string ParseFileName(string? contentDisposition, string fallback)
    {
        if (string.IsNullOrWhiteSpace(contentDisposition)) return fallback;

        var utf8Match = System.Text.RegularExpressions.Regex.Match(contentDisposition, "filename\\*=UTF-8''([^;]+)", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        if (utf8Match.Success) return Uri.UnescapeDataString(utf8Match.Groups[1].Value).Trim('"');

        var plainMatch = System.Text.RegularExpressions.Regex.Match(contentDisposition, "filename=\"?([^\";]+)\"?", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        return plainMatch.Success ? plainMatch.Groups[1].Value.Trim() : fallback;
    }

    public async Task<TrackUploadResult> UploadTracksAsync(IReadOnlyList<string> filePaths, int? albumId = null, bool autoCredits = true, CancellationToken ct = default)
    {
        if (filePaths.Count == 0) throw new ApiException("No files selected.", "EMPTY_FILES");

        using var content = new MultipartFormDataContent();
        foreach (var fp in filePaths)
        {
            if (!File.Exists(fp)) throw new ApiException($"File not found: {fp}", "FILE_NOT_FOUND");
            var stream = File.OpenRead(fp);
            var streamContent = new StreamContent(stream);
            var ext = Path.GetExtension(fp).ToLowerInvariant();
            streamContent.Headers.ContentType = new MediaTypeHeaderValue(ext switch
            {
                ".flac" => "audio/flac", ".mp3" => "audio/mpeg", ".wav" => "audio/wav",
                ".m4a" => "audio/mp4", _ => "audio/ogg"
            });
            content.Add(streamContent, "tracks", Path.GetFileName(fp));
        }
        if (albumId.HasValue) content.Add(new StringContent(albumId.Value.ToString()), "album_id");

        var uri = $"tracks/upload?auto_credits={(autoCredits ? "true" : "false")}";
        using var request = await CreateAuthedRequestAsync(HttpMethod.Post, uri, ct);
        request.Content = content;

        using var response = await Http.SendAsync(request, ct);
        var envelope = await ReadEnvelopeAsync<TrackUploadResult>(response, ct);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
            throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? "Failed to upload tracks.", envelope?.Error?.Code, ct);
        return envelope.Data;
    }

    public async Task<IReadOnlyList<TrackCreditPreviewItem>> PreviewTrackCreditsAsync(IReadOnlyList<string> filePaths, CancellationToken ct = default)
    {
        if (filePaths.Count == 0) return Array.Empty<TrackCreditPreviewItem>();

        using var content = new MultipartFormDataContent();
        foreach (var fp in filePaths)
        {
            if (!File.Exists(fp)) throw new ApiException($"File not found: {fp}", "FILE_NOT_FOUND");
            var stream = File.OpenRead(fp);
            var streamContent = new StreamContent(stream) { Headers = { ContentType = new MediaTypeHeaderValue("audio/flac") } };
            content.Add(streamContent, "tracks", Path.GetFileName(fp));
        }

        using var request = await CreateAuthedRequestAsync(HttpMethod.Post, "tracks/preview-credits", ct);
        request.Content = content;

        using var response = await Http.SendAsync(request, ct);
        var envelope = await ReadEnvelopeAsync<CreditPreviewResponse>(response, ct);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
            throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? "Failed to preview credits.", envelope?.Error?.Code, ct);
        return envelope.Data.Results;
    }

    private sealed class CreditPreviewResponse { public IReadOnlyList<TrackCreditPreviewItem> Results { get; init; } = Array.Empty<TrackCreditPreviewItem>(); }
    private sealed class SameAlbumDuplicateResponseData { public IReadOnlyList<SameAlbumDuplicateGroup> Groups { get; init; } = Array.Empty<SameAlbumDuplicateGroup>(); }
    private sealed class TrackNotesImportCandidatesResponseData { public IReadOnlyList<TrackNotesImportCandidate> Candidates { get; init; } = Array.Empty<TrackNotesImportCandidate>(); }
}
