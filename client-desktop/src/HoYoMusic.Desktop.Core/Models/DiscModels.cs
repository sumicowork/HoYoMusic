using System.Text.Json.Serialization;

namespace HoYoMusic.Desktop.Core.Models;

public sealed class DiscItem
{
    [JsonPropertyName("id")]
    public int Id { get; init; }

    [JsonPropertyName("album_id")]
    public int AlbumId { get; init; }

    [JsonPropertyName("disc_number")]
    public int DiscNumber { get; init; }

    [JsonPropertyName("disc_title")]
    public string? DiscTitle { get; init; }

    [JsonPropertyName("created_at")]
    public DateTimeOffset? CreatedAt { get; init; }
}

public sealed class DiscUpsertRequest
{
    [JsonPropertyName("disc_number")]
    public int DiscNumber { get; init; }

    [JsonPropertyName("disc_title")]
    public string? DiscTitle { get; init; }
}

public sealed class DiscEnvelopeData
{
    [JsonPropertyName("disc")]
    public DiscItem? Disc { get; init; }
}

public sealed class DiscListEnvelopeData
{
    [JsonPropertyName("discs")]
    public IReadOnlyList<DiscItem> Discs { get; init; } = Array.Empty<DiscItem>();
}

public sealed class TrackDiscAssignmentRequest
{
    [JsonPropertyName("disc_id")]
    public int? DiscId { get; init; }
}

public sealed class BulkTrackDiscAssignmentItem
{
    [JsonPropertyName("track_id")]
    public int TrackId { get; init; }

    [JsonPropertyName("disc_id")]
    public int? DiscId { get; init; }
}

public sealed class BulkTrackDiscAssignmentRequest
{
    [JsonPropertyName("assignments")]
    public IReadOnlyList<BulkTrackDiscAssignmentItem> Assignments { get; init; } = Array.Empty<BulkTrackDiscAssignmentItem>();
}

