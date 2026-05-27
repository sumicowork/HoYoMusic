using System.Net.Http.Json;
using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using System.IO;
using HoYoMusic.Desktop.Core.Abstractions;
using HoYoMusic.Desktop.Core.Contracts;
using HoYoMusic.Desktop.Core.Models;

namespace HoYoMusic.Desktop.Infrastructure.Services;

public sealed class GameService : HoYoApiClient, IGameService
{
    public GameService(HttpClient httpClient, ITokenStore tokenStore) : base(httpClient, tokenStore) { }

    public async Task<IReadOnlyList<GameItem>> GetGamesAsync(CancellationToken ct = default)
    {
        using var response = await Http.GetAsync("games", ct);
        var envelope = await response.Content.ReadFromJsonAsync<ApiEnvelope<GameListResponseData>>(JsonOptions, ct);

        if (envelope is null) throw new ApiException("Failed to parse games response.");
        if (!response.IsSuccessStatusCode || !envelope.Success || envelope.Data is null)
            throw new ApiException(envelope.Error?.Message ?? "Failed to load games.", envelope.Error?.Code);

        return envelope.Data.Games.Select(game => new GameItem
        {
            Id = game.Id, Name = game.Name, NameEn = game.NameEn,
            Description = game.Description,
            CoverPath = TryNormalizeCoverPath(game.CoverPath),
            Status = game.Status, DisplayOrder = game.DisplayOrder, AlbumCount = game.AlbumCount,
        }).ToArray();
    }

    public async Task<IReadOnlyList<GameAlbumItem>> GetGameAlbumsAsync(int gameId, CancellationToken ct = default)
    {
        if (gameId <= 0) return Array.Empty<GameAlbumItem>();

        using var response = await Http.GetAsync($"games/{gameId}", ct);
        var envelope = await response.Content.ReadFromJsonAsync<ApiEnvelope<GameDetailResponseData>>(JsonOptions, ct);
        if (envelope is null) throw new ApiException("Failed to parse game detail response.");
        if (!response.IsSuccessStatusCode || !envelope.Success || envelope.Data is null)
            throw new ApiException(envelope.Error?.Message ?? "Failed to load game albums.", envelope.Error?.Code);

        return envelope.Data.Albums.Select(album => new GameAlbumItem
        {
            Id = album.Id, Title = album.Title,
            CoverPath = TryNormalizeCoverPath(album.CoverPath),
            TrackCount = album.TrackCount,
        }).ToArray();
    }

    public async Task<GameItem> CreateGameAsync(GameUpsertRequest request, CancellationToken ct = default)
    {
        var result = await PostAuthedEnvelopeAsync<GameMutationEnvelope>("games", request, "Failed to create game.", ct);
        return result.Game!;
    }

    public async Task<GameItem> UpdateGameAsync(int gameId, GameUpsertRequest request, CancellationToken ct = default)
    {
        var result = await PostAuthedEnvelopeAsync<GameMutationEnvelope>($"games/{gameId}", request, "Failed to update game.", ct, HttpMethod.Put);
        return result.Game!;
    }

    public async Task<GameItem> UploadGameCoverAsync(int gameId, string localFilePath, CancellationToken ct = default)
    {
        if (gameId <= 0) throw new ApiException("Invalid game id.", "INVALID_GAME_ID");
        if (string.IsNullOrWhiteSpace(localFilePath) || !File.Exists(localFilePath))
            throw new ApiException("Cover file does not exist.", "FILE_NOT_FOUND");

        using var authRequest = await CreateAuthedRequestAsync(HttpMethod.Post, $"games/{gameId}/cover", ct);
        using var fileStream = File.OpenRead(localFilePath);
        using var multipart = new MultipartFormDataContent();
        using var streamContent = new StreamContent(fileStream) { Headers = { ContentType = new MediaTypeHeaderValue(ResolveMediaType(localFilePath)) } };
        multipart.Add(streamContent, "cover", Path.GetFileName(localFilePath));
        authRequest.Content = multipart;

        using var response = await Http.SendAsync(authRequest, ct);
        var envelope = await response.Content.ReadFromJsonAsync<ApiEnvelope<GameMutationEnvelope>>(JsonOptions, ct);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data?.Game is null)
            throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? "Failed to upload game cover.", envelope?.Error?.Code, ct);

        return envelope.Data.Game;
    }

    private async Task<TData> PostAuthedEnvelopeAsync<TData>(string uri, object payload, string fallbackError, CancellationToken ct, HttpMethod? method = null) where TData : class
    {
        using var authRequest = await CreateAuthedRequestAsync(method ?? HttpMethod.Post, uri, ct);
        authRequest.Content = JsonContent.Create(payload, options: JsonOptions);
        using var response = await Http.SendAsync(authRequest, ct);
        var envelope = await response.Content.ReadFromJsonAsync<ApiEnvelope<TData>>(JsonOptions, ct);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
            throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? fallbackError, envelope?.Error?.Code, ct);
        return envelope.Data;
    }

    private string? TryNormalizeCoverPath(string? coverPath)
    {
        try { return NormalizeCoverPath(coverPath); }
        catch { return null; }
    }

    private string? NormalizeCoverPath(string? coverPath)
    {
        if (string.IsNullOrWhiteSpace(coverPath)) return null;

        var trimmed = coverPath.Trim();
        var apiBase = Http.BaseAddress ?? ApiConstants.ResolveBaseUri(null);
        var siteBase = new Uri(apiBase.GetLeftPart(UriPartial.Authority));

        if (trimmed.StartsWith("http://", StringComparison.OrdinalIgnoreCase) || trimmed.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            return new Uri(siteBase, $"/api/public/covers/proxy?path={Uri.EscapeDataString(trimmed)}").ToString();

        if (trimmed.StartsWith('/') && !trimmed.StartsWith("/uploads/", StringComparison.OrdinalIgnoreCase))
            return new Uri(siteBase, trimmed).ToString();

        var normalized = trimmed.StartsWith('/') ? trimmed : $"/uploads/{trimmed}";
        return new Uri(siteBase, normalized).ToString();
    }

    private sealed class GameMutationEnvelope { public GameItem? Game { get; init; } }
}
