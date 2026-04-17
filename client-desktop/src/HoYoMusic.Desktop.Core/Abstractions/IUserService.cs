using HoYoMusic.Desktop.Core.Models;

namespace HoYoMusic.Desktop.Core.Abstractions;

public interface IUserService
{
    Task<AdminUserListResult> GetUsersAsync(int page = 1, int pageSize = 20, UserListFilters? filters = null, CancellationToken cancellationToken = default);
    Task<AdminUserItem> UpdateRoleAsync(int userId, bool isAdmin, CancellationToken cancellationToken = default);
    Task<AdminUserItem> UpdateStatusAsync(int userId, string accountStatus, string? reason = null, CancellationToken cancellationToken = default);
    Task<AdminUserItem> UpdateEmailVerificationAsync(int userId, bool emailVerified, CancellationToken cancellationToken = default);
    Task ResetPasswordAsync(int userId, string newPassword, CancellationToken cancellationToken = default);
    Task<UserInsightsResult> GetUserInsightsAsync(int userId, int days = 30, CancellationToken cancellationToken = default);
    Task<UserFullProfileResult> GetUserFullProfileAsync(int userId, CancellationToken cancellationToken = default);
}

