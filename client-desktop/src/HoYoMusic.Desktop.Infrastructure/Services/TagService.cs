using System.Net.Http.Json;
using HoYoMusic.Desktop.Core.Abstractions;
using HoYoMusic.Desktop.Core.Contracts;
using HoYoMusic.Desktop.Core.Models;

namespace HoYoMusic.Desktop.Infrastructure.Services;

public sealed class TagService : HoYoApiClient, ITagService
{
    public TagService(HttpClient httpClient, ITokenStore tokenStore) : base(httpClient, tokenStore) { }

    public async Task<IReadOnlyList<TagItem>> GetTagsAsync(CancellationToken ct = default)
        => await GetPublicAsync<IReadOnlyList<TagItem>>("tags", "Failed to load tags.", ct);

    public async Task<TagItem> GetTagByIdAsync(int tagId, CancellationToken ct = default)
        => await GetPublicAsync<TagItem>($"tags/{tagId}", "Failed to load tag detail.", ct);

    public async Task<TagItem> CreateTagAsync(TagUpsertRequest request, CancellationToken ct = default)
        => await PostFormAsync<TagItem>("tags", request, "Failed to create tag.", ct);

    public async Task<TagItem> UpdateTagAsync(int tagId, TagUpsertRequest request, CancellationToken ct = default)
        => await PostFormAsync<TagItem>($"tags/{tagId}", request, "Failed to update tag.", ct, HttpMethod.Put);

    public async Task DeleteTagAsync(int tagId, CancellationToken ct = default)
        => await DeleteAuthedAsync($"tags/{tagId}", "Failed to delete tag.", ct);

    public async Task<IReadOnlyList<TagItem>> GetTrackTagsAsync(int trackId, CancellationToken ct = default)
        => await GetPublicAsync<IReadOnlyList<TagItem>>($"tags/track/{trackId}", "Failed to load track tags.", ct);

    public async Task AddTagToTrackAsync(int trackId, int tagId, CancellationToken ct = default)
        => await PostVoidAsync($"tags/track/{trackId}", new { tagId }, "Failed to add tag to track.", ct);

    public async Task RemoveTagFromTrackAsync(int trackId, int tagId, CancellationToken ct = default)
        => await DeleteAuthedAsync($"tags/track/{trackId}/{tagId}", "Failed to remove tag from track.", ct);

    public async Task BulkUpdateTrackTagsAsync(BulkTrackTagUpdateRequest request, CancellationToken ct = default)
        => await PostVoidAsync("tags/bulk-update", request, "Failed to bulk update track tags.", ct);

    public async Task<IReadOnlyList<TagGroupItem>> GetTagGroupsAsync(CancellationToken ct = default)
        => await GetPublicAsync<IReadOnlyList<TagGroupItem>>("tags/groups/all", "Failed to load tag groups.", ct);

    public async Task<TagGroupItem> GetTagGroupByIdAsync(int groupId, CancellationToken ct = default)
        => await GetPublicAsync<TagGroupItem>($"tags/groups/{groupId}", "Failed to load tag group.", ct);

    public async Task<TagGroupItem> CreateTagGroupAsync(TagGroupUpsertRequest request, CancellationToken ct = default)
        => await PostFormAsync<TagGroupItem>("tags/groups", request, "Failed to create tag group.", ct);

    public async Task<TagGroupItem> UpdateTagGroupAsync(int groupId, TagGroupUpsertRequest request, CancellationToken ct = default)
        => await PostFormAsync<TagGroupItem>($"tags/groups/{groupId}", request, "Failed to update tag group.", ct, HttpMethod.Put);

    public async Task DeleteTagGroupAsync(int groupId, CancellationToken ct = default)
        => await DeleteAuthedAsync($"tags/groups/{groupId}", "Failed to delete tag group.", ct);

    // --- Helpers ---
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
        using var authRequest = await CreateAuthedRequestAsync(HttpMethod.Post, uri, ct);
        authRequest.Content = JsonContent.Create(payload, options: JsonOptions);
        await SendWithoutDataAsync(authRequest, fallbackError, ct);
    }

    private async Task DeleteAuthedAsync(string uri, string fallbackError, CancellationToken ct)
    {
        using var authRequest = await CreateAuthedRequestAsync(HttpMethod.Delete, uri, ct);
        await SendWithoutDataAsync(authRequest, fallbackError, ct);
    }
}
