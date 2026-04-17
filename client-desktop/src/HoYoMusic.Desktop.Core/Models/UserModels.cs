using System.Text.Json.Serialization;

namespace HoYoMusic.Desktop.Core.Models;

public sealed class AdminUserItem
{
    [JsonPropertyName("id")]
    public int Id { get; init; }

    [JsonPropertyName("username")]
    public string Username { get; init; } = string.Empty;

    [JsonPropertyName("email")]
    public string? Email { get; init; }

    [JsonPropertyName("email_verified")]
    public bool EmailVerified { get; init; }

    [JsonPropertyName("is_admin")]
    public bool IsAdmin { get; init; }

    [JsonPropertyName("account_status")]
    public string AccountStatus { get; init; } = "active";

    [JsonPropertyName("status_reason")]
    public string? StatusReason { get; init; }

    [JsonPropertyName("last_login_at")]
    public DateTimeOffset? LastLoginAt { get; init; }

    [JsonPropertyName("last_login_ip")]
    public string? LastLoginIp { get; init; }

    [JsonPropertyName("created_at")]
    public DateTimeOffset? CreatedAt { get; init; }

    [JsonPropertyName("updated_at")]
    public DateTimeOffset? UpdatedAt { get; init; }
}

public sealed class AdminUserListPagination
{
    [JsonPropertyName("page")]
    public int Page { get; init; }

    [JsonPropertyName("pageSize")]
    public int PageSize { get; init; }

    [JsonPropertyName("total")]
    public int Total { get; init; }

    [JsonPropertyName("totalPages")]
    public int TotalPages { get; init; }
}

public sealed class AdminUserListResult
{
    [JsonPropertyName("items")]
    public IReadOnlyList<AdminUserItem> Items { get; init; } = Array.Empty<AdminUserItem>();

    [JsonPropertyName("pagination")]
    public AdminUserListPagination? Pagination { get; init; }
}

public sealed class UserListFilters
{
    public string? Keyword { get; init; }

    // all | admin | user
    public string? Role { get; init; }

    // all | verified | unverified
    public string? Verified { get; init; }

    // all | active | disabled
    public string? Status { get; init; }
}

public sealed class UpdateUserRoleRequest
{
    [JsonPropertyName("is_admin")]
    public bool IsAdmin { get; init; }
}

public sealed class UpdateUserStatusRequest
{
    [JsonPropertyName("account_status")]
    public string AccountStatus { get; init; } = "active";

    [JsonPropertyName("status_reason")]
    public string? StatusReason { get; init; }
}

public sealed class UpdateUserEmailVerificationRequest
{
    [JsonPropertyName("email_verified")]
    public bool EmailVerified { get; init; }
}

public sealed class ResetUserPasswordRequest
{
    [JsonPropertyName("new_password")]
    public string NewPassword { get; init; } = string.Empty;
}

public sealed class UserInsightActionItem
{
    [JsonPropertyName("action_key")]
    public string ActionKey { get; init; } = string.Empty;

    [JsonPropertyName("action_label")]
    public string ActionLabel { get; init; } = string.Empty;

    [JsonPropertyName("module")]
    public string Module { get; init; } = string.Empty;

    [JsonPropertyName("requests")]
    public int Requests { get; init; }

    [JsonPropertyName("last_seen")]
    public DateTimeOffset? LastSeen { get; init; }
}

public sealed class UserInsightBehaviorItem
{
    [JsonPropertyName("ts")]
    public DateTimeOffset? Timestamp { get; init; }

    [JsonPropertyName("method")]
    public string Method { get; init; } = string.Empty;

    [JsonPropertyName("path")]
    public string Path { get; init; } = string.Empty;

    [JsonPropertyName("status")]
    public int Status { get; init; }

    [JsonPropertyName("duration_ms")]
    public int DurationMs { get; init; }

    [JsonPropertyName("ip")]
    public string? Ip { get; init; }

    [JsonPropertyName("referer")]
    public string? Referer { get; init; }

    [JsonPropertyName("action_key")]
    public string ActionKey { get; init; } = string.Empty;

    [JsonPropertyName("action_label")]
    public string ActionLabel { get; init; } = string.Empty;

    [JsonPropertyName("module")]
    public string Module { get; init; } = string.Empty;

    [JsonPropertyName("resource_type")]
    public string? ResourceType { get; init; }

    [JsonPropertyName("resource_id")]
    public int? ResourceId { get; init; }

    [JsonPropertyName("summary")]
    public string Summary { get; init; } = string.Empty;
}

public sealed class UserInsightsOverview
{
    [JsonPropertyName("total_requests")]
    public int TotalRequests { get; init; }

    [JsonPropertyName("error_requests")]
    public int ErrorRequests { get; init; }

    [JsonPropertyName("error_rate")]
    public decimal ErrorRate { get; init; }

    [JsonPropertyName("unique_paths")]
    public int UniquePaths { get; init; }

    [JsonPropertyName("active_days")]
    public int ActiveDays { get; init; }

    [JsonPropertyName("avg_duration_ms")]
    public decimal AverageDurationMs { get; init; }

    [JsonPropertyName("first_seen")]
    public DateTimeOffset? FirstSeen { get; init; }

    [JsonPropertyName("last_seen")]
    public DateTimeOffset? LastSeen { get; init; }
}

public sealed class UserInsightUser
{
    [JsonPropertyName("id")]
    public int Id { get; init; }

    [JsonPropertyName("username")]
    public string Username { get; init; } = string.Empty;

    [JsonPropertyName("email")]
    public string? Email { get; init; }

    [JsonPropertyName("is_admin")]
    public bool IsAdmin { get; init; }

    [JsonPropertyName("account_status")]
    public string AccountStatus { get; init; } = "active";

    [JsonPropertyName("created_at")]
    public DateTimeOffset? CreatedAt { get; init; }
}

public sealed class UserInsightsResult
{
    [JsonPropertyName("user")]
    public UserInsightUser? User { get; init; }

    [JsonPropertyName("window_days")]
    public int WindowDays { get; init; }

    [JsonPropertyName("overview")]
    public UserInsightsOverview? Overview { get; init; }

    [JsonPropertyName("top_actions")]
    public IReadOnlyList<UserInsightActionItem> TopActions { get; init; } = Array.Empty<UserInsightActionItem>();

    [JsonPropertyName("recent_behaviors")]
    public IReadOnlyList<UserInsightBehaviorItem> RecentBehaviors { get; init; } = Array.Empty<UserInsightBehaviorItem>();
}

public sealed class UserFavoriteProfileItem
{
    [JsonPropertyName("track_id")]
    public int TrackId { get; init; }

    [JsonPropertyName("favorited_at")]
    public DateTimeOffset? FavoritedAt { get; init; }

    [JsonPropertyName("track_title")]
    public string TrackTitle { get; init; } = string.Empty;

    [JsonPropertyName("album_id")]
    public int? AlbumId { get; init; }

    [JsonPropertyName("album_title")]
    public string? AlbumTitle { get; init; }
}

public sealed class UserPlaylistTrackProfileItem
{
    [JsonPropertyName("track_id")]
    public int TrackId { get; init; }

    [JsonPropertyName("track_title")]
    public string TrackTitle { get; init; } = string.Empty;

    [JsonPropertyName("position")]
    public int Position { get; init; }

    [JsonPropertyName("added_at")]
    public DateTimeOffset? AddedAt { get; init; }
}

public sealed class UserPlaylistProfileItem
{
    [JsonPropertyName("id")]
    public int Id { get; init; }

    [JsonPropertyName("name")]
    public string Name { get; init; } = string.Empty;

    [JsonPropertyName("description")]
    public string? Description { get; init; }

    [JsonPropertyName("created_at")]
    public DateTimeOffset? CreatedAt { get; init; }

    [JsonPropertyName("updated_at")]
    public DateTimeOffset? UpdatedAt { get; init; }

    [JsonPropertyName("track_count")]
    public int TrackCount { get; init; }

    [JsonPropertyName("total_duration")]
    public int TotalDuration { get; init; }

    [JsonPropertyName("tracks")]
    public IReadOnlyList<UserPlaylistTrackProfileItem> Tracks { get; init; } = Array.Empty<UserPlaylistTrackProfileItem>();
}

public sealed class UserFullProfileSummary
{
    [JsonPropertyName("favorite_count")]
    public int FavoriteCount { get; init; }

    [JsonPropertyName("playlist_count")]
    public int PlaylistCount { get; init; }

    [JsonPropertyName("playlist_track_count")]
    public int PlaylistTrackCount { get; init; }
}

public sealed class UserFullProfileResult
{
    [JsonPropertyName("user")]
    public AdminUserItem? User { get; init; }

    [JsonPropertyName("favorites")]
    public IReadOnlyList<UserFavoriteProfileItem> Favorites { get; init; } = Array.Empty<UserFavoriteProfileItem>();

    [JsonPropertyName("playlists")]
    public IReadOnlyList<UserPlaylistProfileItem> Playlists { get; init; } = Array.Empty<UserPlaylistProfileItem>();

    [JsonPropertyName("recent_behaviors")]
    public IReadOnlyList<UserInsightBehaviorItem> RecentBehaviors { get; init; } = Array.Empty<UserInsightBehaviorItem>();

    [JsonPropertyName("summary")]
    public UserFullProfileSummary? Summary { get; init; }
}

public sealed class UserEnvelopeData
{
    [JsonPropertyName("user")]
    public AdminUserItem? User { get; init; }
}

