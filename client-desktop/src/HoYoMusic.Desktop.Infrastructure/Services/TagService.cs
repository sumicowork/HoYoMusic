using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using HoYoMusic.Desktop.Core.Abstractions;
using HoYoMusic.Desktop.Core.Contracts;
using HoYoMusic.Desktop.Core.Models;

namespace HoYoMusic.Desktop.Infrastructure.Services;

public sealed class TagService : ITagService
{
    private readonly HttpClient _httpClient;
    private readonly ITokenStore _tokenStore;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public TagService(HttpClient httpClient, ITokenStore tokenStore)
    {
        _httpClient = httpClient;
        _tokenStore = tokenStore;
    }

    public async Task<IReadOnlyList<TagItem>> GetTagsAsync(CancellationToken cancellationToken = default)
    {
        using var response = await _httpClient.GetAsync("tags", cancellationToken);
        var envelope = await ReadEnvelopeAsync<IReadOnlyList<TagItem>>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
        {
            throw new ApiException(envelope?.Error?.Message ?? "Failed to load tags.", envelope?.Error?.Code);
        }

        return envelope.Data;
    }

    public async Task<TagItem> GetTagByIdAsync(int tagId, CancellationToken cancellationToken = default)
    {
        using var response = await _httpClient.GetAsync($"tags/{tagId}", cancellationToken);
        var envelope = await ReadEnvelopeAsync<TagItem>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
        {
            throw new ApiException(envelope?.Error?.Message ?? "Failed to load tag detail.", envelope?.Error?.Code);
        }

        return envelope.Data;
    }

    public async Task<TagItem> CreateTagAsync(TagUpsertRequest request, CancellationToken cancellationToken = default)
    {
        using var authRequest = await CreateAuthenticatedRequestAsync(HttpMethod.Post, "tags", cancellationToken);
        authRequest.Content = JsonContent.Create(request, options: JsonOptions);
        return await SendForTagAsync(authRequest, "Failed to create tag.", cancellationToken);
    }

    public async Task<TagItem> UpdateTagAsync(int tagId, TagUpsertRequest request, CancellationToken cancellationToken = default)
    {
        using var authRequest = await CreateAuthenticatedRequestAsync(HttpMethod.Put, $"tags/{tagId}", cancellationToken);
        authRequest.Content = JsonContent.Create(request, options: JsonOptions);
        return await SendForTagAsync(authRequest, "Failed to update tag.", cancellationToken);
    }

    public async Task DeleteTagAsync(int tagId, CancellationToken cancellationToken = default)
    {
        using var authRequest = await CreateAuthenticatedRequestAsync(HttpMethod.Delete, $"tags/{tagId}", cancellationToken);
        await SendWithoutDataAsync(authRequest, "Failed to delete tag.", cancellationToken);
    }

    public async Task<IReadOnlyList<TagItem>> GetTrackTagsAsync(int trackId, CancellationToken cancellationToken = default)
    {
        using var response = await _httpClient.GetAsync($"tags/track/{trackId}", cancellationToken);
        var envelope = await ReadEnvelopeAsync<IReadOnlyList<TagItem>>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
        {
            throw new ApiException(envelope?.Error?.Message ?? "Failed to load track tags.", envelope?.Error?.Code);
        }

        return envelope.Data;
    }

    public async Task AddTagToTrackAsync(int trackId, int tagId, CancellationToken cancellationToken = default)
    {
        using var authRequest = await CreateAuthenticatedRequestAsync(HttpMethod.Post, $"tags/track/{trackId}", cancellationToken);
        authRequest.Content = JsonContent.Create(new { tagId }, options: JsonOptions);
        await SendWithoutDataAsync(authRequest, "Failed to add tag to track.", cancellationToken);
    }

    public async Task RemoveTagFromTrackAsync(int trackId, int tagId, CancellationToken cancellationToken = default)
    {
        using var authRequest = await CreateAuthenticatedRequestAsync(HttpMethod.Delete, $"tags/track/{trackId}/{tagId}", cancellationToken);
        await SendWithoutDataAsync(authRequest, "Failed to remove tag from track.", cancellationToken);
    }

    public async Task BulkUpdateTrackTagsAsync(BulkTrackTagUpdateRequest request, CancellationToken cancellationToken = default)
    {
        using var authRequest = await CreateAuthenticatedRequestAsync(HttpMethod.Post, "tags/bulk-update", cancellationToken);
        authRequest.Content = JsonContent.Create(request, options: JsonOptions);
        await SendWithoutDataAsync(authRequest, "Failed to bulk update track tags.", cancellationToken);
    }

    public async Task<IReadOnlyList<TagGroupItem>> GetTagGroupsAsync(CancellationToken cancellationToken = default)
    {
        using var response = await _httpClient.GetAsync("tags/groups/all", cancellationToken);
        var envelope = await ReadEnvelopeAsync<IReadOnlyList<TagGroupItem>>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
        {
            throw new ApiException(envelope?.Error?.Message ?? "Failed to load tag groups.", envelope?.Error?.Code);
        }

        return envelope.Data;
    }

    public async Task<TagGroupItem> GetTagGroupByIdAsync(int groupId, CancellationToken cancellationToken = default)
    {
        using var response = await _httpClient.GetAsync($"tags/groups/{groupId}", cancellationToken);
        var envelope = await ReadEnvelopeAsync<TagGroupItem>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
        {
            throw new ApiException(envelope?.Error?.Message ?? "Failed to load tag group.", envelope?.Error?.Code);
        }

        return envelope.Data;
    }

    public async Task<TagGroupItem> CreateTagGroupAsync(TagGroupUpsertRequest request, CancellationToken cancellationToken = default)
    {
        using var authRequest = await CreateAuthenticatedRequestAsync(HttpMethod.Post, "tags/groups", cancellationToken);
        authRequest.Content = JsonContent.Create(request, options: JsonOptions);
        return await SendForTagGroupAsync(authRequest, "Failed to create tag group.", cancellationToken);
    }

    public async Task<TagGroupItem> UpdateTagGroupAsync(int groupId, TagGroupUpsertRequest request, CancellationToken cancellationToken = default)
    {
        using var authRequest = await CreateAuthenticatedRequestAsync(HttpMethod.Put, $"tags/groups/{groupId}", cancellationToken);
        authRequest.Content = JsonContent.Create(request, options: JsonOptions);
        return await SendForTagGroupAsync(authRequest, "Failed to update tag group.", cancellationToken);
    }

    public async Task DeleteTagGroupAsync(int groupId, CancellationToken cancellationToken = default)
    {
        using var authRequest = await CreateAuthenticatedRequestAsync(HttpMethod.Delete, $"tags/groups/{groupId}", cancellationToken);
        await SendWithoutDataAsync(authRequest, "Failed to delete tag group.", cancellationToken);
    }

    private async Task<TagItem> SendForTagAsync(HttpRequestMessage request, string fallbackError, CancellationToken cancellationToken)
    {
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var envelope = await ReadEnvelopeAsync<TagItem>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
        {
            throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? fallbackError, envelope?.Error?.Code, cancellationToken);
        }

        return envelope.Data;
    }

    private async Task<TagGroupItem> SendForTagGroupAsync(HttpRequestMessage request, string fallbackError, CancellationToken cancellationToken)
    {
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var envelope = await ReadEnvelopeAsync<TagGroupItem>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
        {
            throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? fallbackError, envelope?.Error?.Code, cancellationToken);
        }

        return envelope.Data;
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

