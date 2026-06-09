using System.Net.Http.Json;
using HoYoMusic.Desktop.Core.Abstractions;
using HoYoMusic.Desktop.Core.Contracts;
using HoYoMusic.Desktop.Core.Models;

namespace HoYoMusic.Desktop.Infrastructure.Services;

public sealed class MusicSourceService : HoYoApiClient, IMusicSourceService
{
    public MusicSourceService(HttpClient httpClient, ITokenStore tokenStore) : base(httpClient, tokenStore) { }

    public async Task<IReadOnlyList<TrackMusicSourceItem>> GetTrackMusicSourcesAsync(int trackId, CancellationToken ct = default)
    {
        using var response = await Http.GetAsync($"public/tracks/{trackId}/music-sources", ct);
        var envelope = await ReadEnvelopeAsync<TrackMusicSourceResponseData>(response, ct);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
            throw new ApiException(envelope?.Error?.Message ?? "Failed to load music sources.", envelope?.Error?.Code);
        return envelope.Data.Items;
    }

    public async Task<IReadOnlyList<MusicSourceCategoryItem>> GetCategoriesAsync(int gameId, CancellationToken ct = default)
        => (await GetAuthedAsync<CategoriesResponseData>(HttpMethod.Get, $"music-sources/categories?game_id={Math.Max(1, gameId)}", "Failed to load categories.", ct)).Categories;

    public async Task<MusicSourceCategoryItem> CreateCategoryAsync(MusicSourceCategoryUpsertRequest payload, CancellationToken ct = default)
        => (await PostAuthedAsync<CategoryResponseData>("music-sources/categories", payload, "Failed to create category.", ct)).Category!;

    public async Task<MusicSourceCategoryItem> UpdateCategoryAsync(int categoryId, MusicSourceCategoryUpsertRequest payload, CancellationToken ct = default)
        => (await PostAuthedAsync<CategoryResponseData>($"music-sources/categories/{categoryId}", payload, "Failed to update category.", ct, HttpMethod.Put)).Category!;

    public async Task DeleteCategoryAsync(int categoryId, CancellationToken ct = default)
        => await DeleteAuthedAsync($"music-sources/categories/{categoryId}", "Failed to delete category.", ct);

    public async Task<IReadOnlyList<MusicSourceNodeItem>> GetNodesAsync(int gameId, int categoryId, int? parentId = null, bool all = false, CancellationToken ct = default)
    {
        var query = new QueryStringBuilder()
            .Add("game_id", Math.Max(1, gameId))
            .Add("category_id", Math.Max(1, categoryId))
            .Add("parent_id", parentId)
            .Add("all", all ? true : null)
            .ToString();
        return (await GetAuthedAsync<NodesResponseData>(HttpMethod.Get, $"music-sources/nodes{query}", "Failed to load nodes.", ct)).Nodes;
    }

    public async Task<MusicSourceNodeItem> CreateNodeAsync(MusicSourceNodeUpsertRequest payload, CancellationToken ct = default)
        => (await PostAuthedAsync<NodeResponseData>("music-sources/nodes", payload, "Failed to create node.", ct)).Node!;

    public async Task<MusicSourceNodeItem> UpdateNodeAsync(int nodeId, MusicSourceNodeUpsertRequest payload, CancellationToken ct = default)
        => (await PostAuthedAsync<NodeResponseData>($"music-sources/nodes/{nodeId}", payload, "Failed to update node.", ct, HttpMethod.Put)).Node!;

    public async Task DeleteNodeAsync(int nodeId, CancellationToken ct = default)
        => await DeleteAuthedAsync($"music-sources/nodes/{nodeId}", "Failed to delete node.", ct);

    public async Task<MusicSourceImportPreviewResult> PreviewImportAsync(IReadOnlyList<MusicSourceImportEntry> entries, CancellationToken ct = default)
        => await PostAuthedAsync<MusicSourceImportPreviewResult>("music-sources/import/preview", new { entries }, "Failed to preview import.", ct);

    public async Task<IReadOnlyList<MusicSourceImportCandidate>> SearchImportCandidatesAsync(string keyword, int limit = 30, CancellationToken ct = default)
    {
        var query = new QueryStringBuilder()
            .Add("keyword", keyword.NullIfWhiteSpace())
            .Add("limit", Math.Clamp(limit, 1, 200))
            .ToString();
        return (await GetAuthedAsync<CandidatesResponseData>(HttpMethod.Get, $"music-sources/import/candidates{query}", "Failed to search candidates.", ct)).Candidates;
    }

    public async Task<MusicSourceImportCommitResult> CommitImportAsync(IReadOnlyList<MusicSourceImportEntry> entries, IReadOnlyDictionary<string, int> resolutions, string conflictMode, CancellationToken ct = default)
        => await PostAuthedAsync<MusicSourceImportCommitResult>("music-sources/import/commit", new
        {
            entries, resolutions,
            conflict_mode = string.IsNullOrWhiteSpace(conflictMode) ? "overwrite" : conflictMode,
        }, "Failed to commit import.", ct);

    public async Task<BinaryFileResult> ExportMusicSourcesAsync(MusicSourceExportPayload payload, CancellationToken ct = default)
    {
        using var request = await CreateAuthedRequestAsync(HttpMethod.Post, "music-sources/export", ct, payload);
        using var response = await Http.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
        {
            var envelope = await ReadEnvelopeAsync<object>(response, ct);
            throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? "Failed to export music sources.", envelope?.Error?.Code, ct);
        }

        var content = await response.Content.ReadAsByteArrayAsync(ct);
        return new BinaryFileResult
        {
            Content = content,
            FileName = ParseDispositionFileName(response, "music-sources-export.json"),
            ContentType = response.Content.Headers.ContentType?.MediaType ?? "application/octet-stream",
        };
    }

    // --- Helpers ---
    private async Task<TData> GetAuthedAsync<TData>(HttpMethod method, string uri, string fallbackError, CancellationToken ct) where TData : class
    {
        using var request = await CreateAuthedRequestAsync(method, uri, ct);
        using var response = await Http.SendAsync(request, ct);
        var envelope = await ReadEnvelopeAsync<TData>(response, ct);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
            throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? fallbackError, envelope?.Error?.Code, ct);
        return envelope.Data;
    }

    private async Task<TData> PostAuthedAsync<TData>(string uri, object payload, string fallbackError, CancellationToken ct, HttpMethod? method = null) where TData : class
    {
        using var request = await CreateAuthedRequestAsync(method ?? HttpMethod.Post, uri, ct, payload);
        using var response = await Http.SendAsync(request, ct);
        var envelope = await ReadEnvelopeAsync<TData>(response, ct);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
            throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? fallbackError, envelope?.Error?.Code, ct);
        return envelope.Data;
    }

    private async Task DeleteAuthedAsync(string uri, string fallbackError, CancellationToken ct)
    {
        using var request = await CreateAuthedRequestAsync(HttpMethod.Delete, uri, ct);
        using var response = await Http.SendAsync(request, ct);
        var envelope = await ReadEnvelopeAsync<object>(response, ct);
        if (!response.IsSuccessStatusCode || envelope?.Success != true)
            throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? fallbackError, envelope?.Error?.Code, ct);
    }

    private static string ParseDispositionFileName(HttpResponseMessage response, string fallback)
    {
        var cd = response.Content.Headers.ContentDisposition?.ToString();
        if (string.IsNullOrWhiteSpace(cd)) return fallback;

        var utf8 = System.Text.RegularExpressions.Regex.Match(cd, "filename\\*=UTF-8''([^;]+)", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        if (utf8.Success) return Uri.UnescapeDataString(utf8.Groups[1].Value).Trim('"');

        var plain = System.Text.RegularExpressions.Regex.Match(cd, "filename=\"?([^\";]+)\"?", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        return plain.Success ? plain.Groups[1].Value.Trim() : fallback;
    }

    private sealed class TrackMusicSourceResponseData { public IReadOnlyList<TrackMusicSourceItem> Items { get; init; } = Array.Empty<TrackMusicSourceItem>(); }
    private sealed class CategoriesResponseData { public IReadOnlyList<MusicSourceCategoryItem> Categories { get; init; } = Array.Empty<MusicSourceCategoryItem>(); }
    private sealed class CategoryResponseData { public MusicSourceCategoryItem? Category { get; init; } }
    private sealed class NodesResponseData { public IReadOnlyList<MusicSourceNodeItem> Nodes { get; init; } = Array.Empty<MusicSourceNodeItem>(); }
    private sealed class NodeResponseData { public MusicSourceNodeItem? Node { get; init; } }
    private sealed class CandidatesResponseData { public IReadOnlyList<MusicSourceImportCandidate> Candidates { get; init; } = Array.Empty<MusicSourceImportCandidate>(); }
}
