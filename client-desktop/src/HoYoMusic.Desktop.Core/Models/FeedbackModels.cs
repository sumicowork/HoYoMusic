using System.Text.Json.Serialization;

namespace HoYoMusic.Desktop.Core.Models;

public sealed class FeedbackItem
{
    [JsonPropertyName("id")]
    public int Id { get; init; }

    [JsonPropertyName("content")]
    public string Content { get; init; } = string.Empty;

    [JsonPropertyName("contact")]
    public string? Contact { get; init; }

    [JsonPropertyName("ip")]
    public string? Ip { get; init; }

    [JsonPropertyName("user_agent")]
    public string? UserAgent { get; init; }

    [JsonPropertyName("created_at")]
    public DateTimeOffset? CreatedAt { get; init; }
}

public sealed class FeedbackPagination
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

public sealed class FeedbackListResult
{
    [JsonPropertyName("items")]
    public IReadOnlyList<FeedbackItem> Items { get; init; } = Array.Empty<FeedbackItem>();

    [JsonPropertyName("pagination")]
    public FeedbackPagination? Pagination { get; init; }
}

public sealed class SubmitFeedbackRequest
{
    [JsonPropertyName("content")]
    public string Content { get; init; } = string.Empty;

    [JsonPropertyName("contact")]
    public string Contact { get; init; } = string.Empty;
}

