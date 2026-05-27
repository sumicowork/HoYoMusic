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

public sealed class ArtistService : HoYoApiClient, IArtistService
{
    public ArtistService(HttpClient httpClient, ITokenStore tokenStore) : base(httpClient, tokenStore) { }

    public async Task<ArtistListResult> GetArtistsAsync(int page = 1, int limit = 50, string? search = null, bool includeAliases = true, CancellationToken ct = default)
    {
        var query = new QueryStringBuilder()
            .Add("page", Math.Max(1, page))
            .Add("limit", Math.Clamp(limit, 1, 100))
            .Add("search", search.NullIfWhiteSpace())
            .Add("include_aliases", includeAliases ? "true" : null)
            .ToString();

        using var response = await Http.GetAsync($"artists{query}", ct);
        var envelope = await ReadEnvelopeAsync<ArtistListResult>(response, ct);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
            throw new ApiException(envelope?.Error?.Message ?? "Failed to load artists.", envelope?.Error?.Code);
        return envelope.Data;
    }

    public async Task<IReadOnlyList<ArtistAliasItem>> GetAliasesAsync(CancellationToken ct = default)
        => (await GetEnvelopeAsync<AliasListEnvelope>("artists/aliases", "Failed to load artist aliases.", ct)).Aliases ?? Array.Empty<ArtistAliasItem>();

    public async Task<IReadOnlyList<ArtistRoleAliasItem>> GetRoleAliasesAsync(CancellationToken ct = default)
        => (await GetEnvelopeAsync<RoleAliasListEnvelope>("artists/roles/aliases", "Failed to load artist role aliases.", ct)).Aliases ?? Array.Empty<ArtistRoleAliasItem>();

    public async Task<IReadOnlyDictionary<string, string>> GetAvatarsAsync(CancellationToken ct = default)
        => (await GetEnvelopeAsync<AvatarEnvelope>("artists/avatars", "Failed to load artist avatars.", ct)).Avatars ?? new Dictionary<string, string>();

    public async Task UpdateArtistAsync(string sourceName, ArtistUpdateRequest request, CancellationToken ct = default)
    {
        var escaped = Uri.EscapeDataString(sourceName);
        using var authRequest = await CreateAuthedRequestAsync(HttpMethod.Put, $"artists/{escaped}", ct);
        authRequest.Content = JsonContent.Create(request, options: JsonOptions);
        await SendWithoutDataAsync(authRequest, "Failed to update artist.", ct);
    }

    public async Task<string> UploadAvatarAsync(string artistName, string localFilePath, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(artistName))
            throw new ApiException("Artist name is required.", "INVALID_ARTIST");
        if (string.IsNullOrWhiteSpace(localFilePath) || !File.Exists(localFilePath))
            throw new ApiException("Avatar file does not exist.", "FILE_NOT_FOUND");

        var escapedName = Uri.EscapeDataString(artistName.Trim());
        using var authRequest = await CreateAuthedRequestAsync(HttpMethod.Post, $"artists/avatar/{escapedName}", ct);
        using var fileStream = File.OpenRead(localFilePath);
        using var multipart = new MultipartFormDataContent();
        using var streamContent = new StreamContent(fileStream) { Headers = { ContentType = new MediaTypeHeaderValue(ResolveMediaType(localFilePath)) } };
        multipart.Add(streamContent, "avatar", Path.GetFileName(localFilePath));
        authRequest.Content = multipart;

        using var response = await Http.SendAsync(authRequest, ct);
        var envelope = await ReadEnvelopeAsync<AvatarUploadData>(response, ct);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || string.IsNullOrWhiteSpace(envelope.Data?.AvatarPath))
            throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? "Failed to upload artist avatar.", envelope?.Error?.Code, ct);

        return envelope.Data.AvatarPath;
    }

    public async Task MergeArtistsAsync(string canonicalName, IReadOnlyList<string> aliasNames, CancellationToken ct = default)
    {
        using var authRequest = await CreateAuthedRequestAsync(HttpMethod.Post, "artists/merge", ct);
        authRequest.Content = JsonContent.Create(new { canonicalName, aliasNames }, options: JsonOptions);
        await SendWithoutDataAsync(authRequest, "Failed to merge artists.", ct);
    }

    public async Task MergeRolesAsync(string canonicalRole, IReadOnlyList<string> aliasRoles, CancellationToken ct = default)
    {
        using var authRequest = await CreateAuthedRequestAsync(HttpMethod.Post, "artists/roles/merge", ct);
        authRequest.Content = JsonContent.Create(new { canonicalRole, aliasRoles }, options: JsonOptions);
        await SendWithoutDataAsync(authRequest, "Failed to merge artist roles.", ct);
    }

    public async Task DeleteAliasAsync(int aliasId, CancellationToken ct = default)
    {
        using var authRequest = await CreateAuthedRequestAsync(HttpMethod.Delete, $"artists/aliases/{aliasId}", ct);
        await SendWithoutDataAsync(authRequest, "Failed to delete artist alias.", ct);
    }

    public async Task DeleteRoleAliasAsync(int aliasId, CancellationToken ct = default)
    {
        using var authRequest = await CreateAuthedRequestAsync(HttpMethod.Delete, $"artists/roles/aliases/{aliasId}", ct);
        await SendWithoutDataAsync(authRequest, "Failed to delete artist role alias.", ct);
    }

    private async Task<TData> GetEnvelopeAsync<TData>(string uri, string fallbackError, CancellationToken ct) where TData : class
    {
        using var response = await Http.GetAsync(uri, ct);
        var envelope = await ReadEnvelopeAsync<TData>(response, ct);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
            throw new ApiException(envelope?.Error?.Message ?? fallbackError, envelope?.Error?.Code);
        return envelope.Data;
    }

    private sealed class AliasListEnvelope { public IReadOnlyList<ArtistAliasItem>? Aliases { get; init; } }
    private sealed class RoleAliasListEnvelope { public IReadOnlyList<ArtistRoleAliasItem>? Aliases { get; init; } }
    private sealed class AvatarEnvelope { public IReadOnlyDictionary<string, string>? Avatars { get; init; } }
    private sealed class AvatarUploadData { [JsonPropertyName("avatar_path")] public string? AvatarPath { get; init; } }
}
