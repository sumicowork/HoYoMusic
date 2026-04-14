using HoYoMusic.Desktop.Core.Models;

namespace HoYoMusic.Desktop.Core.Abstractions;

public interface IAuthService
{
    Task<AuthSession> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default);
    Task<string?> SendRegistrationVerificationCodeAsync(SendVerificationCodeRequest request, CancellationToken cancellationToken = default);
    Task<AuthSession> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken = default);
    Task<string?> GetSavedTokenAsync(CancellationToken cancellationToken = default);
    Task<AuthUser?> GetCurrentUserAsync(CancellationToken cancellationToken = default);
    Task ChangePasswordAsync(ChangePasswordRequest request, CancellationToken cancellationToken = default);
    Task LogoutAsync(CancellationToken cancellationToken = default);
}

