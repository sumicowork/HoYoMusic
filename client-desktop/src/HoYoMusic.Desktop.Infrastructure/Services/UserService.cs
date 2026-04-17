using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using HoYoMusic.Desktop.Core.Abstractions;
using HoYoMusic.Desktop.Core.Contracts;
using HoYoMusic.Desktop.Core.Models;

namespace HoYoMusic.Desktop.Infrastructure.Services;

public sealed class UserService : IUserService
{
    private readonly HttpClient _httpClient;
    private readonly ITokenStore _tokenStore;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public UserService(HttpClient httpClient, ITokenStore tokenStore)
    {
        _httpClient = httpClient;
        _tokenStore = tokenStore;
    }

    public async Task<AdminUserListResult> GetUsersAsync(int page = 1, int pageSize = 20, UserListFilters? filters = null, CancellationToken cancellationToken = default)
    {
        var query = new QueryStringBuilder()
            .Add("page", Math.Max(1, page))
            .Add("pageSize", Math.Clamp(pageSize, 1, 100))
            .Add("keyword", string.IsNullOrWhiteSpace(filters?.Keyword) ? null : filters.Keyword.Trim())
            .Add("role", string.IsNullOrWhiteSpace(filters?.Role) || filters.Role == "all" ? null : filters.Role)
            .Add("verified", string.IsNullOrWhiteSpace(filters?.Verified) || filters.Verified == "all" ? null : filters.Verified)
            .Add("status", string.IsNullOrWhiteSpace(filters?.Status) || filters.Status == "all" ? null : filters.Status)
            .ToString();

        using var request = await CreateAuthenticatedRequestAsync(HttpMethod.Get, $"users{query}", cancellationToken);
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var envelope = await ReadEnvelopeAsync<AdminUserListResult>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
        {
            throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? "Failed to fetch users.", envelope?.Error?.Code, cancellationToken);
        }

        return envelope.Data;
    }

    public Task<AdminUserItem> UpdateRoleAsync(int userId, bool isAdmin, CancellationToken cancellationToken = default)
    {
        return PatchForUserAsync(userId, "role", new UpdateUserRoleRequest { IsAdmin = isAdmin }, "Failed to update user role.", cancellationToken);
    }

    public Task<AdminUserItem> UpdateStatusAsync(int userId, string accountStatus, string? reason = null, CancellationToken cancellationToken = default)
    {
        return PatchForUserAsync(userId, "status", new UpdateUserStatusRequest { AccountStatus = accountStatus, StatusReason = reason }, "Failed to update user status.", cancellationToken);
    }

    public Task<AdminUserItem> UpdateEmailVerificationAsync(int userId, bool emailVerified, CancellationToken cancellationToken = default)
    {
        return PatchForUserAsync(userId, "email-verification", new UpdateUserEmailVerificationRequest { EmailVerified = emailVerified }, "Failed to update email verification.", cancellationToken);
    }

    public async Task ResetPasswordAsync(int userId, string newPassword, CancellationToken cancellationToken = default)
    {
        using var request = await CreateAuthenticatedRequestAsync(HttpMethod.Post, $"users/{userId}/reset-password", cancellationToken);
        request.Content = JsonContent.Create(new ResetUserPasswordRequest { NewPassword = newPassword }, options: JsonOptions);
        await SendWithoutDataAsync(request, "Failed to reset password.", cancellationToken);
    }

    public async Task<UserInsightsResult> GetUserInsightsAsync(int userId, int days = 30, CancellationToken cancellationToken = default)
    {
        using var request = await CreateAuthenticatedRequestAsync(HttpMethod.Get, $"users/{userId}/insights?days={Math.Clamp(days, 1, 365)}", cancellationToken);
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var envelope = await ReadEnvelopeAsync<UserInsightsResult>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
        {
            throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? "Failed to fetch user insights.", envelope?.Error?.Code, cancellationToken);
        }

        return envelope.Data;
    }

    public async Task<UserFullProfileResult> GetUserFullProfileAsync(int userId, CancellationToken cancellationToken = default)
    {
        using var request = await CreateAuthenticatedRequestAsync(HttpMethod.Get, $"users/{userId}/full-profile", cancellationToken);
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var envelope = await ReadEnvelopeAsync<UserFullProfileResult>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
        {
            throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? "Failed to fetch user profile.", envelope?.Error?.Code, cancellationToken);
        }

        return envelope.Data;
    }

    private async Task<AdminUserItem> PatchForUserAsync(int userId, string action, object payload, string fallbackError, CancellationToken cancellationToken)
    {
        using var request = await CreateAuthenticatedRequestAsync(HttpMethod.Patch, $"users/{userId}/{action}", cancellationToken);
        request.Content = JsonContent.Create(payload, options: JsonOptions);

        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var envelope = await ReadEnvelopeAsync<UserEnvelopeData>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data?.User is null)
        {
            throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? fallbackError, envelope?.Error?.Code, cancellationToken);
        }

        return envelope.Data.User;
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
}

