using HoYoMusic.Desktop.Core.Abstractions;
using HoYoMusic.Desktop.Infrastructure.Services;
using HoYoMusic.Desktop.Infrastructure.Storage;
using Microsoft.Extensions.DependencyInjection;

namespace HoYoMusic.Desktop.Infrastructure;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddHoYoMusicInfrastructure(this IServiceCollection services)
    {
        services.AddSingleton<ITokenStore, WindowsCredentialTokenStore>();

        services.AddHttpClient<IAuthService, AuthService>(client =>
        {
            client.BaseAddress = ApiConstants.ApiBaseUri;
        });

        services.AddHttpClient<ITrackService, TrackService>(client =>
        {
            client.BaseAddress = ApiConstants.ApiBaseUri;
        });

        return services;
    }
}

