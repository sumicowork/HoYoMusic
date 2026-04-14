namespace HoYoMusic.Desktop.Core.Abstractions;

public interface ITokenStore
{
    Task SaveTokenAsync(string token, CancellationToken cancellationToken = default);
    Task<string?> GetTokenAsync(CancellationToken cancellationToken = default);
    Task ClearTokenAsync(CancellationToken cancellationToken = default);
}

