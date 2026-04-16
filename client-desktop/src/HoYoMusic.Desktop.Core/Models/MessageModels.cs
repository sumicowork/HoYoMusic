using System.Text.Json.Serialization;

namespace HoYoMusic.Desktop.Core.Models;

public sealed class InboxMessageItem
{
    [JsonPropertyName("id")]
    public int Id { get; init; }

    [JsonPropertyName("message_id")]
    public int MessageId { get; init; }

    [JsonPropertyName("title")]
    public string Title { get; init; } = string.Empty;

    [JsonPropertyName("content")]
    public string Content { get; init; } = string.Empty;

    [JsonPropertyName("sender_username")]
    public string? SenderUsername { get; init; }

    [JsonPropertyName("is_read")]
    public bool IsRead { get; init; }

    [JsonPropertyName("delivered_at")]
    public DateTimeOffset? DeliveredAt { get; init; }

    [JsonIgnore]
    public string Meta => string.IsNullOrWhiteSpace(SenderUsername)
        ? (DeliveredAt?.ToString("yyyy-MM-dd HH:mm") ?? string.Empty)
        : $"{SenderUsername} · {DeliveredAt:yyyy-MM-dd HH:mm}";
}

public sealed class InboxMessagePagination
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

public sealed class InboxMessagesResponseData
{
    [JsonPropertyName("items")]
    public IReadOnlyList<InboxMessageItem> Items { get; init; } = Array.Empty<InboxMessageItem>();

    [JsonPropertyName("pagination")]
    public InboxMessagePagination? Pagination { get; init; }
}

public sealed class UnreadCountResponseData
{
    [JsonPropertyName("unread")]
    public int Unread { get; init; }
}

public sealed class SendAdminMessageResponseData
{
    [JsonPropertyName("delivery_count")]
    public int DeliveryCount { get; init; }
}

