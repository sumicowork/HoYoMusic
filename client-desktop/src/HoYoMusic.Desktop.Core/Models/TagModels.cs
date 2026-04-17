using System.Text.Json.Serialization;

namespace HoYoMusic.Desktop.Core.Models;

public sealed class TagItem
{
    [JsonPropertyName("id")]
    public int Id { get; init; }

    [JsonPropertyName("name")]
    public string Name { get; init; } = string.Empty;

    [JsonPropertyName("color")]
    public string Color { get; init; } = "#6B9EFF";

    [JsonPropertyName("description")]
    public string? Description { get; init; }

    [JsonPropertyName("group_id")]
    public int? GroupId { get; init; }

    [JsonPropertyName("group_name")]
    public string? GroupName { get; init; }

    [JsonPropertyName("group_icon")]
    public string? GroupIcon { get; init; }

    [JsonPropertyName("parent_id")]
    public int? ParentId { get; init; }

    [JsonPropertyName("parent_name")]
    public string? ParentName { get; init; }

    [JsonPropertyName("icon")]
    public string? Icon { get; init; }

    [JsonPropertyName("display_order")]
    public int? DisplayOrder { get; init; }

    [JsonPropertyName("full_path")]
    public string? FullPath { get; init; }

    [JsonPropertyName("track_count")]
    public int? TrackCount { get; init; }

    [JsonPropertyName("children_count")]
    public int? ChildrenCount { get; init; }

    [JsonPropertyName("children")]
    public IReadOnlyList<TagItem> Children { get; init; } = Array.Empty<TagItem>();

    [JsonPropertyName("created_at")]
    public DateTimeOffset? CreatedAt { get; init; }

    [JsonPropertyName("updated_at")]
    public DateTimeOffset? UpdatedAt { get; init; }
}

public sealed class TagGroupItem
{
    [JsonPropertyName("id")]
    public int Id { get; init; }

    [JsonPropertyName("name")]
    public string Name { get; init; } = string.Empty;

    [JsonPropertyName("description")]
    public string? Description { get; init; }

    [JsonPropertyName("icon")]
    public string? Icon { get; init; }

    [JsonPropertyName("display_order")]
    public int DisplayOrder { get; init; }

    [JsonPropertyName("parent_group_id")]
    public int? ParentGroupId { get; init; }

    [JsonPropertyName("parent_group_name")]
    public string? ParentGroupName { get; init; }

    [JsonPropertyName("tag_count")]
    public int? TagCount { get; init; }

    [JsonPropertyName("tags")]
    public IReadOnlyList<TagItem> Tags { get; init; } = Array.Empty<TagItem>();

    [JsonPropertyName("children")]
    public IReadOnlyList<TagGroupItem> Children { get; init; } = Array.Empty<TagGroupItem>();

    [JsonPropertyName("created_at")]
    public DateTimeOffset? CreatedAt { get; init; }

    [JsonPropertyName("updated_at")]
    public DateTimeOffset? UpdatedAt { get; init; }
}

public sealed class TagUpsertRequest
{
    [JsonPropertyName("name")]
    public string Name { get; init; } = string.Empty;

    [JsonPropertyName("color")]
    public string? Color { get; init; }

    [JsonPropertyName("description")]
    public string? Description { get; init; }

    [JsonPropertyName("group_id")]
    public int? GroupId { get; init; }

    [JsonPropertyName("parent_id")]
    public int? ParentId { get; init; }

    [JsonPropertyName("icon")]
    public string? Icon { get; init; }

    [JsonPropertyName("display_order")]
    public int? DisplayOrder { get; init; }
}

public sealed class TagGroupUpsertRequest
{
    [JsonPropertyName("name")]
    public string Name { get; init; } = string.Empty;

    [JsonPropertyName("description")]
    public string? Description { get; init; }

    [JsonPropertyName("icon")]
    public string? Icon { get; init; }

    [JsonPropertyName("display_order")]
    public int? DisplayOrder { get; init; }

    [JsonPropertyName("parent_group_id")]
    public int? ParentGroupId { get; init; }
}

public sealed class BulkTrackTagUpdateRequest
{
    [JsonPropertyName("trackIds")]
    public IReadOnlyList<int> TrackIds { get; init; } = Array.Empty<int>();

    [JsonPropertyName("addTagIds")]
    public IReadOnlyList<int> AddTagIds { get; init; } = Array.Empty<int>();

    [JsonPropertyName("removeTagIds")]
    public IReadOnlyList<int> RemoveTagIds { get; init; } = Array.Empty<int>();
}

