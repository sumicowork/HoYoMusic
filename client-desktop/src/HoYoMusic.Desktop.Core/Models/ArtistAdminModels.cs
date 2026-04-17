using System.Text.Json.Serialization;

namespace HoYoMusic.Desktop.Core.Models;

public sealed class ArtistAdminItem
{
    [JsonPropertyName("name")]
    public string Name { get; init; } = string.Empty;

    [JsonPropertyName("track_count")]
    public int TrackCount { get; init; }

    [JsonPropertyName("album_count")]
    public int AlbumCount { get; init; }

    [JsonPropertyName("roles")]
    public IReadOnlyList<string> Roles { get; init; } = Array.Empty<string>();

    [JsonPropertyName("is_alias")]
    public bool IsAlias { get; init; }

    [JsonPropertyName("canonical_name")]
    public string? CanonicalName { get; init; }

    [JsonIgnore]
    public string DisplayName => IsAlias && !string.IsNullOrWhiteSpace(CanonicalName)
        ? $"{Name} (别名: {CanonicalName})"
        : Name;

    [JsonIgnore]
    public string RolesDisplay => Roles.Count == 0 ? "-" : string.Join(", ", Roles);
}

public sealed class ArtistAliasItem
{
    [JsonPropertyName("id")]
    public int Id { get; init; }

    [JsonPropertyName("canonical_name")]
    public string CanonicalName { get; init; } = string.Empty;

    [JsonPropertyName("alias_name")]
    public string AliasName { get; init; } = string.Empty;

    [JsonIgnore]
    public string DisplayName => $"{AliasName} -> {CanonicalName}";
}

public sealed class ArtistRoleAliasItem
{
    [JsonPropertyName("id")]
    public int Id { get; init; }

    [JsonPropertyName("canonical_role")]
    public string CanonicalRole { get; init; } = string.Empty;

    [JsonPropertyName("alias_role")]
    public string AliasRole { get; init; } = string.Empty;

    [JsonIgnore]
    public string DisplayName => $"{AliasRole} -> {CanonicalRole}";
}

public sealed class ArtistUpdateRequest
{
    [JsonPropertyName("name")]
    public string Name { get; init; } = string.Empty;

    [JsonPropertyName("roleMappings")]
    public IReadOnlyList<ArtistRoleMapping> RoleMappings { get; init; } = Array.Empty<ArtistRoleMapping>();
}

public sealed class ArtistRoleMapping
{
    [JsonPropertyName("from")]
    public string From { get; init; } = string.Empty;

    [JsonPropertyName("to")]
    public string To { get; init; } = string.Empty;
}

public sealed class ArtistListResult
{
    [JsonPropertyName("artists")]
    public IReadOnlyList<ArtistAdminItem> Artists { get; init; } = Array.Empty<ArtistAdminItem>();

    [JsonPropertyName("pagination")]
    public ArtistPaginationItem? Pagination { get; init; }
}

public sealed class ArtistPaginationItem
{
    [JsonPropertyName("page")]
    public int Page { get; init; }

    [JsonPropertyName("limit")]
    public int Limit { get; init; }

    [JsonPropertyName("total")]
    public int Total { get; init; }

    [JsonPropertyName("totalPages")]
    public int TotalPages { get; init; }
}

