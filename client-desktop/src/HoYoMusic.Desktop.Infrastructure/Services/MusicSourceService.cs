using System.Net.Http.Json;
using System.Net.Http.Headers;
using System.Text.Json;
using HoYoMusic.Desktop.Core.Abstractions;
using HoYoMusic.Desktop.Core.Contracts;
using HoYoMusic.Desktop.Core.Models;

namespace HoYoMusic.Desktop.Infrastructure.Services;

public sealed class MusicSourceService : IMusicSourceService
{
    private readonly HttpClient _httpClient;
    private readonly ITokenStore _tokenStore;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public MusicSourceService(HttpClient httpClient, ITokenStore tokenStore)
    {
        _httpClient = httpClient;
        _tokenStore = tokenStore;
    }

    public async Task<IReadOnlyList<TrackMusicSourceItem>> GetTrackMusicSourcesAsync(int trackId, CancellationToken cancellationToken = default)
    {
        using var response = await _httpClient.GetAsync($"public/tracks/{trackId}/music-sources", cancellationToken);
        var envelope = await ReadEnvelopeAsync<TrackMusicSourceResponseData>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
        {
            throw new ApiException(envelope?.Error?.Message ?? "Failed to load music sources.", envelope?.Error?.Code);
        }

        return envelope.Data.Items;
    }

    public async Task<IReadOnlyList<MusicSourceCategoryItem>> GetCategoriesAsync(int gameId, CancellationToken cancellationToken = default)
    {
        using var request = await CreateAuthedRequestAsync(HttpMethod.Get, $"music-sources/categories?game_id={Math.Max(1, gameId)}", cancellationToken);
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var envelope = await ReadEnvelopeAsync<CategoriesResponseData>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
        {
            throw new ApiException(envelope?.Error?.Message ?? "Failed to load categories.", envelope?.Error?.Code);
        }

        return envelope.Data.Categories;
    }

    public async Task<MusicSourceCategoryItem> CreateCategoryAsync(MusicSourceCategoryUpsertRequest payload, CancellationToken cancellationToken = default)
    {
        using var request = await CreateAuthedRequestAsync(HttpMethod.Post, "music-sources/categories", cancellationToken, payload);
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var envelope = await ReadEnvelopeAsync<CategoryResponseData>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data?.Category is null)
        {
            throw new ApiException(envelope?.Error?.Message ?? "Failed to create category.", envelope?.Error?.Code);
        }

        return envelope.Data.Category;
    }

    public async Task<MusicSourceCategoryItem> UpdateCategoryAsync(int categoryId, MusicSourceCategoryUpsertRequest payload, CancellationToken cancellationToken = default)
    {
        using var request = await CreateAuthedRequestAsync(HttpMethod.Put, $"music-sources/categories/{categoryId}", cancellationToken, payload);
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var envelope = await ReadEnvelopeAsync<CategoryResponseData>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data?.Category is null)
        {
            throw new ApiException(envelope?.Error?.Message ?? "Failed to update category.", envelope?.Error?.Code);
        }

        return envelope.Data.Category;
    }

    public async Task DeleteCategoryAsync(int categoryId, CancellationToken cancellationToken = default)
    {
        using var request = await CreateAuthedRequestAsync(HttpMethod.Delete, $"music-sources/categories/{categoryId}", cancellationToken);
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var envelope = await ReadEnvelopeAsync<object>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true)
        {
            throw new ApiException(envelope?.Error?.Message ?? "Failed to delete category.", envelope?.Error?.Code);
        }
    }

    public async Task<IReadOnlyList<MusicSourceNodeItem>> GetNodesAsync(int gameId, int categoryId, int? parentId = null, bool all = false, CancellationToken cancellationToken = default)
    {
        var query = new QueryStringBuilder()
            .Add("game_id", Math.Max(1, gameId))
            .Add("category_id", Math.Max(1, categoryId))
            .Add("parent_id", parentId)
            .Add("all", all ? true : null)
            .ToString();

        using var request = await CreateAuthedRequestAsync(HttpMethod.Get, $"music-sources/nodes{query}", cancellationToken);
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var envelope = await ReadEnvelopeAsync<NodesResponseData>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
        {
            throw new ApiException(envelope?.Error?.Message ?? "Failed to load nodes.", envelope?.Error?.Code);
        }

        return envelope.Data.Nodes;
    }

    public async Task<MusicSourceNodeItem> CreateNodeAsync(MusicSourceNodeUpsertRequest payload, CancellationToken cancellationToken = default)
    {
        using var request = await CreateAuthedRequestAsync(HttpMethod.Post, "music-sources/nodes", cancellationToken, payload);
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var envelope = await ReadEnvelopeAsync<NodeResponseData>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data?.Node is null)
        {
            throw new ApiException(envelope?.Error?.Message ?? "Failed to create node.", envelope?.Error?.Code);
        }

        return envelope.Data.Node;
    }

    public async Task<MusicSourceNodeItem> UpdateNodeAsync(int nodeId, MusicSourceNodeUpsertRequest payload, CancellationToken cancellationToken = default)
    {
        using var request = await CreateAuthedRequestAsync(HttpMethod.Put, $"music-sources/nodes/{nodeId}", cancellationToken, payload);
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var envelope = await ReadEnvelopeAsync<NodeResponseData>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data?.Node is null)
        {
            throw new ApiException(envelope?.Error?.Message ?? "Failed to update node.", envelope?.Error?.Code);
        }

        return envelope.Data.Node;
    }

    public async Task DeleteNodeAsync(int nodeId, CancellationToken cancellationToken = default)
    {
        using var request = await CreateAuthedRequestAsync(HttpMethod.Delete, $"music-sources/nodes/{nodeId}", cancellationToken);
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var envelope = await ReadEnvelopeAsync<object>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true)
        {
            throw new ApiException(envelope?.Error?.Message ?? "Failed to delete node.", envelope?.Error?.Code);
        }
    }

    public async Task<MusicSourceImportPreviewResult> PreviewImportAsync(IReadOnlyList<MusicSourceImportEntry> entries, CancellationToken cancellationToken = default)
    {
        using var request = await CreateAuthedRequestAsync(HttpMethod.Post, "music-sources/import/preview", cancellationToken, new { entries });
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var envelope = await ReadEnvelopeAsync<MusicSourceImportPreviewResult>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
        {
            throw new ApiException(envelope?.Error?.Message ?? "Failed to preview import.", envelope?.Error?.Code);
        }

        return envelope.Data;
    }

    public async Task<IReadOnlyList<MusicSourceImportCandidate>> SearchImportCandidatesAsync(string keyword, int limit = 30, CancellationToken cancellationToken = default)
    {
        var query = new QueryStringBuilder()
            .Add("keyword", string.IsNullOrWhiteSpace(keyword) ? null : keyword.Trim())
            .Add("limit", Math.Clamp(limit, 1, 200))
            .ToString();

        using var request = await CreateAuthedRequestAsync(HttpMethod.Get, $"music-sources/import/candidates{query}", cancellationToken);
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var envelope = await ReadEnvelopeAsync<CandidatesResponseData>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
        {
            throw new ApiException(envelope?.Error?.Message ?? "Failed to search candidates.", envelope?.Error?.Code);
        }

        return envelope.Data.Candidates;
    }

    public async Task<MusicSourceImportCommitResult> CommitImportAsync(IReadOnlyList<MusicSourceImportEntry> entries, IReadOnlyDictionary<string, int> resolutions, string conflictMode, CancellationToken cancellationToken = default)
    {
        using var request = await CreateAuthedRequestAsync(HttpMethod.Post, "music-sources/import/commit", cancellationToken, new
        {
            entries,
            resolutions,
            conflict_mode = string.IsNullOrWhiteSpace(conflictMode) ? "overwrite" : conflictMode,
        });
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var envelope = await ReadEnvelopeAsync<MusicSourceImportCommitResult>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
        {
            throw new ApiException(envelope?.Error?.Message ?? "Failed to commit import.", envelope?.Error?.Code);
        }

        return envelope.Data;
    }

    public async Task<BinaryFileResult> ExportMusicSourcesAsync(MusicSourceExportPayload payload, CancellationToken cancellationToken = default)
    {
        using var request = await CreateAuthedRequestAsync(HttpMethod.Post, "music-sources/export", cancellationToken, payload);
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var envelope = await ReadEnvelopeAsync<object>(response, cancellationToken);
            throw new ApiException(envelope?.Error?.Message ?? "Failed to export music sources.", envelope?.Error?.Code);
        }

        var content = await response.Content.ReadAsByteArrayAsync(cancellationToken);
        return new BinaryFileResult
        {
            Content = content,
            FileName = ParseFileName(response.Content.Headers.ContentDisposition?.ToString(), "music-sources-export.json"),
            ContentType = response.Content.Headers.ContentType?.MediaType ?? "application/octet-stream",
        };
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

    private sealed class CategoriesResponseData
    {
        public IReadOnlyList<MusicSourceCategoryItem> Categories { get; init; } = Array.Empty<MusicSourceCategoryItem>();
    }

    private sealed class CategoryResponseData
    {
        public MusicSourceCategoryItem? Category { get; init; }
    }

    private sealed class NodesResponseData
    {
        public IReadOnlyList<MusicSourceNodeItem> Nodes { get; init; } = Array.Empty<MusicSourceNodeItem>();
    }

    private sealed class NodeResponseData
    {
        public MusicSourceNodeItem? Node { get; init; }
    }

    private sealed class CandidatesResponseData
    {
        public IReadOnlyList<MusicSourceImportCandidate> Candidates { get; init; } = Array.Empty<MusicSourceImportCandidate>();
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

