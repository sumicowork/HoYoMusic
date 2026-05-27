using System.Net.Http.Json;
using HoYoMusic.Desktop.Core.Abstractions;
using HoYoMusic.Desktop.Core.Contracts;
using HoYoMusic.Desktop.Core.Models;

namespace HoYoMusic.Desktop.Infrastructure.Services;

public sealed class UserService : HoYoApiClient, IUserService
{
    public UserService(HttpClient httpClient, ITokenStore tokenStore) : base(httpClient, tokenStore) { }

    public async Task<AdminUserListResult> GetUsersAsync(int page = 1, int pageSize = 20, UserListFilters? filters = null, CancellationToken ct = default)
    {
        var query = new QueryStringBuilder()
            .Add("page", Math.Max(1, page))
            .Add("pageSize", Math.Clamp(pageSize, 1, 100))
            .Add("keyword", filters?.Keyword.NullIfWhiteSpace())
            .Add("role", filters?.Role is null or "all" ? null : filters.Role)
            .Add("verified", filters?.Verified is null or "all" ? null : filters.Verified)
            .Add("status", filters?.Status is null or "all" ? null : filters.Status)
            .ToString();
        return await GetAuthedAsync<AdminUserListResult>(HttpMethod.Get, $"users{query}", "Failed to fetch users.", ct);
    }

    public Task<AdminUserItem> UpdateRoleAsync(int userId, bool isAdmin, CancellationToken ct = default)
        => PatchUserAsync(userId, "role", new UpdateUserRoleRequest { IsAdmin = isAdmin }, "Failed to update user role.", ct);

    public Task<AdminUserItem> UpdateStatusAsync(int userId, string accountStatus, string? reason = null, CancellationToken ct = default)
        => PatchUserAsync(userId, "status", new UpdateUserStatusRequest { AccountStatus = accountStatus, StatusReason = reason }, "Failed to update user status.", ct);

    public Task<AdminUserItem> UpdateEmailVerificationAsync(int userId, bool emailVerified, CancellationToken ct = default)
        => PatchUserAsync(userId, "email-verification", new UpdateUserEmailVerificationRequest { EmailVerified = emailVerified }, "Failed to update email verification.", ct);

    public async Task ResetPasswordAsync(int userId, string newPassword, CancellationToken ct = default)
    {
        using var request = await CreateAuthedRequestAsync(HttpMethod.Post, $"users/{userId}/reset-password", ct);
        request.Content = JsonContent.Create(new ResetUserPasswordRequest { NewPassword = newPassword }, options: JsonOptions);
        await SendWithoutDataAsync(request, "Failed to reset password.", ct);
    }

    public async Task<UserInsightsResult> GetUserInsightsAsync(int userId, int days = 30, CancellationToken ct = default)
        => await GetAuthedAsync<UserInsightsResult>(HttpMethod.Get, $"users/{userId}/insights?days={Math.Clamp(days, 1, 365)}", "Failed to fetch user insights.", ct);

    public async Task<UserFullProfileResult> GetUserFullProfileAsync(int userId, CancellationToken ct = default)
        => await GetAuthedAsync<UserFullProfileResult>(HttpMethod.Get, $"users/{userId}/full-profile", "Failed to fetch user profile.", ct);

    private async Task<AdminUserItem> PatchUserAsync(int userId, string action, object payload, string fallbackError, CancellationToken ct)
    {
        using var request = await CreateAuthedRequestAsync(HttpMethod.Patch, $"users/{userId}/{action}", ct);
        request.Content = JsonContent.Create(payload, options: JsonOptions);
        using var response = await Http.SendAsync(request, ct);
        var envelope = await ReadEnvelopeAsync<UserEnvelope>(response, ct);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data?.User is null)
            throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? fallbackError, envelope?.Error?.Code, ct);
        return envelope.Data.User;
    }

    private async Task<TData> GetAuthedAsync<TData>(HttpMethod method, string uri, string fallbackError, CancellationToken ct) where TData : class
    {
        using var request = await CreateAuthedRequestAsync(method, uri, ct);
        using var response = await Http.SendAsync(request, ct);
        var envelope = await ReadEnvelopeAsync<TData>(response, ct);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
            throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? fallbackError, envelope?.Error?.Code, ct);
        return envelope.Data;
    }

    private sealed class UserEnvelope { public AdminUserItem? User { get; init; } }
}
