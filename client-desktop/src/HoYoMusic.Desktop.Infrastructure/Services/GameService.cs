using System.Net.Http.Json;
using System.Text.Json;
using HoYoMusic.Desktop.Core.Abstractions;
using HoYoMusic.Desktop.Core.Contracts;
using HoYoMusic.Desktop.Core.Models;

namespace HoYoMusic.Desktop.Infrastructure.Services;

public sealed class GameService : IGameService
{
    private readonly HttpClient _httpClient;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public GameService(HttpClient httpClient)
    {
        _httpClient = httpClient;
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
}

