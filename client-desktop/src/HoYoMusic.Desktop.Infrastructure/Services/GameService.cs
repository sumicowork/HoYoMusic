using System.Net.Http.Json;
using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using System.IO;
using HoYoMusic.Desktop.Core.Abstractions;
using HoYoMusic.Desktop.Core.Contracts;
using HoYoMusic.Desktop.Core.Models;

namespace HoYoMusic.Desktop.Infrastructure.Services;

public sealed class GameService : IGameService
{
    private readonly HttpClient _httpClient;
    private readonly ITokenStore _tokenStore;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public GameService(HttpClient httpClient, ITokenStore tokenStore)
    {
        _httpClient = httpClient;
        _tokenStore = tokenStore;
    }

    public async Task<IReadOnlyList<GameItem>> GetGamesAsync(CancellationToken cancellationToken = default)
    {
        using var response = await _httpClient.GetAsync("games", cancellationToken);
        var envelope = await response.Content.ReadFromJsonAsync<ApiEnvelope<GameListResponseData>>(JsonOptions, cancellationToken);

        if (envelope is null)
        {
            throw new ApiException("Failed to parse games response.");
        }

        if (!response.IsSuccessStatusCode || !envelope.Success || envelope.Data is null)
        {
            throw new ApiException(envelope.Error?.Message ?? "Failed to load games.", envelope.Error?.Code);
        }

        var normalized = envelope.Data.Games
            .Select(game => new GameItem
            {
                Id = game.Id,
                Name = game.Name,
                NameEn = game.NameEn,
                Description = game.Description,
                CoverPath = TryNormalizeCoverPath(game.CoverPath),
                Status = game.Status,
                DisplayOrder = game.DisplayOrder,
                AlbumCount = game.AlbumCount,
            })
            .ToArray();

        return normalized;
    }

    public async Task<IReadOnlyList<GameAlbumItem>> GetGameAlbumsAsync(int gameId, CancellationToken cancellationToken = default)
    {
        if (gameId <= 0)
        {
            return Array.Empty<GameAlbumItem>();
        }

        using var response = await _httpClient.GetAsync($"games/{gameId}", cancellationToken);
        var envelope = await response.Content.ReadFromJsonAsync<ApiEnvelope<GameDetailResponseData>>(JsonOptions, cancellationToken);
        if (envelope is null)
        {
            throw new ApiException("Failed to parse game detail response.");
        }

        if (!response.IsSuccessStatusCode || !envelope.Success || envelope.Data is null)
        {
            throw new ApiException(envelope.Error?.Message ?? "Failed to load game albums.", envelope.Error?.Code);
        }

        return envelope.Data.Albums
            .Select(album => new GameAlbumItem
            {
                Id = album.Id,
                Title = album.Title,
                CoverPath = TryNormalizeCoverPath(album.CoverPath),
                TrackCount = album.TrackCount,
            })
            .ToArray();
    }

    public async Task<GameItem> CreateGameAsync(GameUpsertRequest request, CancellationToken cancellationToken = default)
    {
        using var authRequest = await CreateAuthenticatedRequestAsync(HttpMethod.Post, "games", cancellationToken);
        authRequest.Content = JsonContent.Create(request, options: JsonOptions);
        using var response = await _httpClient.SendAsync(authRequest, cancellationToken);
        var envelope = await response.Content.ReadFromJsonAsync<ApiEnvelope<GameMutationEnvelope>>(JsonOptions, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data?.Game is null)
        {
            throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? "Failed to create game.", envelope?.Error?.Code, cancellationToken);
        }

        return envelope.Data.Game;
    }

    public async Task<GameItem> UpdateGameAsync(int gameId, GameUpsertRequest request, CancellationToken cancellationToken = default)
    {
        using var authRequest = await CreateAuthenticatedRequestAsync(HttpMethod.Put, $"games/{gameId}", cancellationToken);
        authRequest.Content = JsonContent.Create(request, options: JsonOptions);
        using var response = await _httpClient.SendAsync(authRequest, cancellationToken);
        var envelope = await response.Content.ReadFromJsonAsync<ApiEnvelope<GameMutationEnvelope>>(JsonOptions, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data?.Game is null)
        {
            throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? "Failed to update game.", envelope?.Error?.Code, cancellationToken);
        }

        return envelope.Data.Game;
    }

    public async Task<GameItem> UploadGameCoverAsync(int gameId, string localFilePath, CancellationToken cancellationToken = default)
    {
        if (gameId <= 0)
        {
            throw new ApiException("Invalid game id.", "INVALID_GAME_ID");
        }

        if (string.IsNullOrWhiteSpace(localFilePath) || !File.Exists(localFilePath))
        {
            throw new ApiException("Cover file does not exist.", "FILE_NOT_FOUND");
        }

        using var authRequest = await CreateAuthenticatedRequestAsync(HttpMethod.Post, $"games/{gameId}/cover", cancellationToken);
        using var fileStream = File.OpenRead(localFilePath);
        using var multipart = new MultipartFormDataContent();
        using var streamContent = new StreamContent(fileStream);
        streamContent.Headers.ContentType = new MediaTypeHeaderValue(ResolveMediaType(localFilePath));
        multipart.Add(streamContent, "cover", Path.GetFileName(localFilePath));
        authRequest.Content = multipart;

        using var response = await _httpClient.SendAsync(authRequest, cancellationToken);
        var envelope = await response.Content.ReadFromJsonAsync<ApiEnvelope<GameMutationEnvelope>>(JsonOptions, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data?.Game is null)
        {
            throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? "Failed to upload game cover.", envelope?.Error?.Code, cancellationToken);
        }

        return envelope.Data.Game;
    }

    private string? TryNormalizeCoverPath(string? coverPath)
    {
        try
        {
            return NormalizeCoverPath(coverPath);
        }
        catch
        {
            // Do not break the whole game list because of one invalid cover path.
            return null;
        }
    }

    private string? NormalizeCoverPath(string? coverPath)
    {
        if (string.IsNullOrWhiteSpace(coverPath))
        {
            return null;
        }

        var trimmed = coverPath.Trim();
        var apiBase = _httpClient.BaseAddress ?? ApiConstants.ResolveBaseUri(null);
        var siteBase = new Uri(apiBase.GetLeftPart(UriPartial.Authority));

        // Keep desktop behavior consistent with frontend getCoverUrl:
        // absolute remote resources are proxied via /api/public/covers/proxy.
        if (trimmed.StartsWith("http://", StringComparison.OrdinalIgnoreCase)
            || trimmed.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        {
            var encoded = Uri.EscapeDataString(trimmed);
            return new Uri(siteBase, $"/api/public/covers/proxy?path={encoded}").ToString();
        }

        // Static game assets under /games/* are served from site root.
        if (trimmed.StartsWith('/') && !trimmed.StartsWith("/uploads/", StringComparison.OrdinalIgnoreCase))
        {
            return new Uri(siteBase, trimmed).ToString();
        }

        var normalized = trimmed.StartsWith('/') ? trimmed : $"/uploads/{trimmed}";
        return new Uri(siteBase, normalized).ToString();
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

    private sealed class GameMutationEnvelope
    {
        public GameItem? Game { get; init; }
    }
}

