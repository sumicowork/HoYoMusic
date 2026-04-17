using System.Text.Json.Serialization;

namespace HoYoMusic.Desktop.Core.Models;

public sealed class AnalyticsOverviewItem
{
    [JsonPropertyName("total")]
    public int Total { get; init; }

    [JsonPropertyName("today")]
    public int Today { get; init; }

    [JsonPropertyName("unique7d")]
    public int Unique7d { get; init; }

    [JsonPropertyName("errors")]
    public int Errors { get; init; }

    [JsonPropertyName("avgMs")]
    public int AvgMs { get; init; }

    [JsonPropertyName("pageView")]
    public int PageView { get; init; }
}

public sealed class AnalyticsHourlyItem
{
    [JsonPropertyName("hour")]
    public int Hour { get; init; }

    [JsonPropertyName("requests")]
    public int Requests { get; init; }

    [JsonPropertyName("visitors")]
    public int Visitors { get; init; }

    [JsonIgnore]
    public string HourDisplay => $"{Hour:00}:00";
}

public sealed class AnalyticsRecentVisitItem
{
    [JsonPropertyName("id")]
    public long Id { get; init; }

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

    [JsonIgnore]
    public string TimestampDisplay => Timestamp?.ToLocalTime().ToString("MM-dd HH:mm:ss") ?? "--";
}

public sealed class AnalyticsTopPageItem
{
    [JsonPropertyName("path")]
    public string Path { get; init; } = string.Empty;

    [JsonPropertyName("hits")]
    public int Hits { get; init; }

    [JsonPropertyName("visitors")]
    public int Visitors { get; init; }

    [JsonPropertyName("avg_ms")]
    public int AvgMs { get; init; }

    [JsonPropertyName("p95_ms")]
    public int P95Ms { get; init; }

    [JsonPropertyName("errors")]
    public int Errors { get; init; }
}

public sealed class AnalyticsStatusCodeItem
{
    [JsonPropertyName("name")]
    public string Name { get; init; } = string.Empty;

    [JsonPropertyName("value")]
    public int Value { get; init; }
}

