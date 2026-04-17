using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.IO;
using HoYoMusic.Desktop.Core.Abstractions;
using HoYoMusic.Desktop.Core.Contracts;
using HoYoMusic.Desktop.Core.Models;

namespace HoYoMusic.Desktop.Infrastructure.Services;

public sealed class ArtistService : IArtistService
{
    private readonly HttpClient _httpClient;
    private readonly ITokenStore _tokenStore;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public ArtistService(HttpClient httpClient, ITokenStore tokenStore)
    {
        _httpClient = httpClient;
        _tokenStore = tokenStore;
    }

    public async Task<ArtistListResult> GetArtistsAsync(int page = 1, int limit = 50, string? search = null, bool includeAliases = true, CancellationToken cancellationToken = default)
    {
        var query = new QueryStringBuilder()
            .Add("page", Math.Max(1, page))
            .Add("limit", Math.Clamp(limit, 1, 100))
            .Add("search", string.IsNullOrWhiteSpace(search) ? null : search.Trim())
            .Add("include_aliases", includeAliases ? "true" : null)
            .ToString();

        using var response = await _httpClient.GetAsync($"artists{query}", cancellationToken);
        var envelope = await ReadEnvelopeAsync<ArtistListResult>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
        {
            throw new ApiException(envelope?.Error?.Message ?? "Failed to load artists.", envelope?.Error?.Code);
        }

        return envelope.Data;
    }

    public async Task<IReadOnlyList<ArtistAliasItem>> GetAliasesAsync(CancellationToken cancellationToken = default)
    {
        using var response = await _httpClient.GetAsync("artists/aliases", cancellationToken);
        var envelope = await ReadEnvelopeAsync<ArtistAliasListEnvelope>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data?.Aliases is null)
        {
            throw new ApiException(envelope?.Error?.Message ?? "Failed to load artist aliases.", envelope?.Error?.Code);
        }

        return envelope.Data.Aliases;
    }

    public async Task<IReadOnlyList<ArtistRoleAliasItem>> GetRoleAliasesAsync(CancellationToken cancellationToken = default)
    {
        using var response = await _httpClient.GetAsync("artists/roles/aliases", cancellationToken);
        var envelope = await ReadEnvelopeAsync<ArtistRoleAliasListEnvelope>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data?.Aliases is null)
        {
            throw new ApiException(envelope?.Error?.Message ?? "Failed to load artist role aliases.", envelope?.Error?.Code);
        }

        return envelope.Data.Aliases;
    }

    public async Task<IReadOnlyDictionary<string, string>> GetAvatarsAsync(CancellationToken cancellationToken = default)
    {
        using var response = await _httpClient.GetAsync("artists/avatars", cancellationToken);
        var envelope = await ReadEnvelopeAsync<ArtistAvatarEnvelope>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data?.Avatars is null)
        {
            throw new ApiException(envelope?.Error?.Message ?? "Failed to load artist avatars.", envelope?.Error?.Code);
        }

        return envelope.Data.Avatars;
    }

    public async Task UpdateArtistAsync(string sourceName, ArtistUpdateRequest request, CancellationToken cancellationToken = default)
    {
        var escaped = Uri.EscapeDataString(sourceName);
        using var authRequest = await CreateAuthenticatedRequestAsync(HttpMethod.Put, $"artists/{escaped}", cancellationToken);
        authRequest.Content = JsonContent.Create(request, options: JsonOptions);
        await SendWithoutDataAsync(authRequest, "Failed to update artist.", cancellationToken);
    }

    public async Task<string> UploadAvatarAsync(string artistName, string localFilePath, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(artistName))
        {
            throw new ApiException("Artist name is required.", "INVALID_ARTIST");
        }

        if (string.IsNullOrWhiteSpace(localFilePath) || !File.Exists(localFilePath))
        {
            throw new ApiException("Avatar file does not exist.", "FILE_NOT_FOUND");
        }

        var escapedName = Uri.EscapeDataString(artistName.Trim());
        using var authRequest = await CreateAuthenticatedRequestAsync(HttpMethod.Post, $"artists/avatar/{escapedName}", cancellationToken);
        using var fileStream = File.OpenRead(localFilePath);
        using var multipart = new MultipartFormDataContent();
        using var streamContent = new StreamContent(fileStream);
        streamContent.Headers.ContentType = new MediaTypeHeaderValue(ResolveMediaType(localFilePath));
        multipart.Add(streamContent, "avatar", Path.GetFileName(localFilePath));
        authRequest.Content = multipart;

        using var response = await _httpClient.SendAsync(authRequest, cancellationToken);
        var envelope = await ReadEnvelopeAsync<ArtistAvatarUploadData>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || string.IsNullOrWhiteSpace(envelope.Data?.AvatarPath))
        {
            throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? "Failed to upload artist avatar.", envelope?.Error?.Code, cancellationToken);
        }

        return envelope.Data.AvatarPath;
    }

    public async Task MergeArtistsAsync(string canonicalName, IReadOnlyList<string> aliasNames, CancellationToken cancellationToken = default)
    {
        using var authRequest = await CreateAuthenticatedRequestAsync(HttpMethod.Post, "artists/merge", cancellationToken);
        authRequest.Content = JsonContent.Create(new { canonicalName, aliasNames }, options: JsonOptions);
        await SendWithoutDataAsync(authRequest, "Failed to merge artists.", cancellationToken);
    }

    public async Task MergeRolesAsync(string canonicalRole, IReadOnlyList<string> aliasRoles, CancellationToken cancellationToken = default)
    {
        using var authRequest = await CreateAuthenticatedRequestAsync(HttpMethod.Post, "artists/roles/merge", cancellationToken);
        authRequest.Content = JsonContent.Create(new { canonicalRole, aliasRoles }, options: JsonOptions);
        await SendWithoutDataAsync(authRequest, "Failed to merge artist roles.", cancellationToken);
    }

    public async Task DeleteAliasAsync(int aliasId, CancellationToken cancellationToken = default)
    {
        using var authRequest = await CreateAuthenticatedRequestAsync(HttpMethod.Delete, $"artists/aliases/{aliasId}", cancellationToken);
        await SendWithoutDataAsync(authRequest, "Failed to delete artist alias.", cancellationToken);
    }

    public async Task DeleteRoleAliasAsync(int aliasId, CancellationToken cancellationToken = default)
    {
        using var authRequest = await CreateAuthenticatedRequestAsync(HttpMethod.Delete, $"artists/roles/aliases/{aliasId}", cancellationToken);
        await SendWithoutDataAsync(authRequest, "Failed to delete artist role alias.", cancellationToken);
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

    private sealed class ArtistAliasListEnvelope
    {
        public IReadOnlyList<ArtistAliasItem>? Aliases { get; init; }
    }

    private sealed class ArtistRoleAliasListEnvelope
    {
        public IReadOnlyList<ArtistRoleAliasItem>? Aliases { get; init; }
    }

    private sealed class ArtistAvatarEnvelope
    {
        public IReadOnlyDictionary<string, string>? Avatars { get; init; }
    }

    private sealed class ArtistAvatarUploadData
    {
        [JsonPropertyName("avatar_path")]
        public string? AvatarPath { get; init; }
    }

    private static string ResolveMediaType(string localFilePath)
    {
        return Path.GetExtension(localFilePath).ToLowerInvariant() switch
        {
            ".png" => "image/png",
            ".jpg" or ".jpeg" => "image/jpeg",
            ".webp" => "image/webp",
            ".gif" => "image/gif",
            _ => "application/octet-stream",
        };
    }
}

