using System.Net.Http.Json;
using System.Net.Http.Headers;
using System.Text.Json;
using HoYoMusic.Desktop.Core.Abstractions;
using HoYoMusic.Desktop.Core.Contracts;
using HoYoMusic.Desktop.Core.Models;

namespace HoYoMusic.Desktop.Infrastructure.Services;

public sealed class AuthService : IAuthService
{
    private readonly HttpClient _httpClient;
    private readonly ITokenStore _tokenStore;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public AuthService(HttpClient httpClient, ITokenStore tokenStore)
    {
        _httpClient = httpClient;
        _tokenStore = tokenStore;
    }

    public async Task<AuthSession> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default)
    {
        using var response = await _httpClient.PostAsJsonAsync("auth/login", new
        {
            identifier = request.Identifier,
            password = request.Password,
        }, JsonOptions, cancellationToken);

        var envelope = await response.Content.ReadFromJsonAsync<ApiEnvelope<LoginResponseData>>(JsonOptions, cancellationToken);
        if (envelope is null)
        {
            throw new ApiException("Failed to parse login response.");
        }

        if (!response.IsSuccessStatusCode || !envelope.Success || envelope.Data is null || string.IsNullOrWhiteSpace(envelope.Data.Token))
        {
            var message = envelope.Error?.Message ?? "Login failed.";
            throw new ApiException(message, envelope.Error?.Code);
        }

        await _tokenStore.SaveTokenAsync(envelope.Data.Token, cancellationToken);

        return new AuthSession
        {
            Token = envelope.Data.Token,
            User = envelope.Data.User,
        };
    }

    public async Task<string?> SendRegistrationVerificationCodeAsync(SendVerificationCodeRequest request, CancellationToken cancellationToken = default)
    {
        using var response = await _httpClient.PostAsJsonAsync("auth/send-verification-code", new
        {
            email = request.Email.Trim(),
        }, JsonOptions, cancellationToken);

        var envelope = await response.Content.ReadFromJsonAsync<ApiEnvelope<SendVerificationCodeResponseData>>(JsonOptions, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true)
        {
            throw new ApiException(envelope?.Error?.Message ?? "Failed to send verification code.", envelope?.Error?.Code);
        }

        return envelope.Data?.VerificationChallengeId;
    }

    public async Task<AuthSession> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken = default)
    {
        using var response = await _httpClient.PostAsJsonAsync("auth/register", new
        {
            username = request.Username.Trim(),
            email = request.Email.Trim(),
            verification_challenge_id = request.VerificationChallengeId.Trim(),
            verification_code = request.VerificationCode.Trim(),
            password = request.Password,
            confirm_password = request.ConfirmPassword,
        }, JsonOptions, cancellationToken);

        var envelope = await response.Content.ReadFromJsonAsync<ApiEnvelope<LoginResponseData>>(JsonOptions, cancellationToken);
        if (envelope is null)
        {
            throw new ApiException("Failed to parse register response.");
        }

        if (!response.IsSuccessStatusCode || !envelope.Success || envelope.Data is null || string.IsNullOrWhiteSpace(envelope.Data.Token))
        {
            throw new ApiException(envelope.Error?.Message ?? "Register failed.", envelope.Error?.Code);
        }

        await _tokenStore.SaveTokenAsync(envelope.Data.Token, cancellationToken);
        return new AuthSession
        {
            Token = envelope.Data.Token,
            User = envelope.Data.User,
        };
    }

    public Task<string?> GetSavedTokenAsync(CancellationToken cancellationToken = default)
        => _tokenStore.GetTokenAsync(cancellationToken);

    public async Task<AuthUser?> GetCurrentUserAsync(CancellationToken cancellationToken = default)
    {
        var token = await _tokenStore.GetTokenAsync(cancellationToken);
        if (string.IsNullOrWhiteSpace(token))
        {
            return null;
        }

        using var request = new HttpRequestMessage(HttpMethod.Get, "auth/me");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var response = await _httpClient.SendAsync(request, cancellationToken);
        if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
        {
            await _tokenStore.ClearTokenAsync(cancellationToken);
            throw new ApiException("登录状态已过期，请重新登录。", "UNAUTHORIZED");
        }

        var envelope = await response.Content.ReadFromJsonAsync<ApiEnvelope<CurrentUserResponseData>>(JsonOptions, cancellationToken);

        if (!response.IsSuccessStatusCode || envelope?.Success != true)
        {
            var message = envelope?.Error?.Message ?? "Failed to load current user.";
            throw new ApiException(message, envelope?.Error?.Code);
        }

        return envelope.Data?.User;
    }

    public async Task ChangePasswordAsync(ChangePasswordRequest request, CancellationToken cancellationToken = default)
    {
        var token = await _tokenStore.GetTokenAsync(cancellationToken);
        if (string.IsNullOrWhiteSpace(token))
        {
            throw new ApiException("Not authenticated.", "MISSING_TOKEN");
        }

        using var message = new HttpRequestMessage(HttpMethod.Post, "auth/change-password")
        {
            Content = JsonContent.Create(new
            {
                currentPassword = request.CurrentPassword,
                newPassword = request.NewPassword,
            }),
        };
        message.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var response = await _httpClient.SendAsync(message, cancellationToken);
        var envelope = await response.Content.ReadFromJsonAsync<ApiEnvelope<object>>(JsonOptions, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true)
        {
            if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
            {
                await _tokenStore.ClearTokenAsync(cancellationToken);
                throw new ApiException("Session expired. Please login again.", "UNAUTHORIZED");
            }

            throw new ApiException(envelope?.Error?.Message ?? "Failed to change password.", envelope?.Error?.Code);
        }
    }

    public Task LogoutAsync(CancellationToken cancellationToken = default)
        => _tokenStore.ClearTokenAsync(cancellationToken);
}

