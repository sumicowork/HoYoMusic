using HoYoMusic.Desktop.Core.Abstractions;
using HoYoMusic.Desktop.Infrastructure.Services;
using HoYoMusic.Desktop.Infrastructure.Storage;
using Microsoft.Extensions.DependencyInjection;
using System.Net.Http;

namespace HoYoMusic.Desktop.Infrastructure;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddHoYoMusicInfrastructure(this IServiceCollection services, string? apiBaseUrl = null)
    {
        var baseUri = ApiConstants.ResolveBaseUri(apiBaseUrl);

        services.AddSingleton<ITokenStore, WindowsCredentialTokenStore>();
        services.AddSingleton<IDownloadService>(_ =>
        {
            var client = new HttpClient
            {
                BaseAddress = baseUri,
            };
            return new DownloadQueueService(client);
        });

        services.AddHttpClient<IAuthService, AuthService>(client =>
        {
            client.BaseAddress = baseUri;
        });

        services.AddHttpClient<ITrackService, TrackService>(client =>
        {
            client.BaseAddress = baseUri;
        });

        services.AddHttpClient<IDiscoverService, DiscoverService>(client =>
        {
            client.BaseAddress = baseUri;
        });

        services.AddHttpClient<IGameService, GameService>(client =>
        {
            client.BaseAddress = baseUri;
        });

        services.AddHttpClient<IAlbumService, AlbumService>(client =>
        {
            client.BaseAddress = baseUri;
        });

        services.AddHttpClient<IFavoriteService, FavoriteService>(client =>
        {
            client.BaseAddress = baseUri;
        });

        services.AddHttpClient<IPlaylistService, PlaylistService>(client =>
        {
            client.BaseAddress = baseUri;
        });

        services.AddHttpClient<ILyricsService, LyricsService>(client =>
        {
            client.BaseAddress = baseUri;
        });

        services.AddHttpClient<ICreditsService, CreditsService>(client =>
        {
            client.BaseAddress = baseUri;
        });

        services.AddHttpClient<IMusicSourceService, MusicSourceService>(client =>
        {
            client.BaseAddress = baseUri;
        });

        services.AddHttpClient<IMessageService, MessageService>(client =>
        {
            client.BaseAddress = baseUri;
        });

        return services;
    }
}
