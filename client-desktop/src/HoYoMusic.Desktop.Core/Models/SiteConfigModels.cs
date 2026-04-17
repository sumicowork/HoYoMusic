using System.Text.Json.Serialization;

namespace HoYoMusic.Desktop.Core.Models;

public sealed class FirstVisitModalConfig
{
    [JsonPropertyName("enabled")]
    public bool Enabled { get; init; }

    [JsonPropertyName("title")]
    public string Title { get; init; } = string.Empty;

    [JsonPropertyName("content")]
    public string Content { get; init; } = string.Empty;

    [JsonPropertyName("min_stay_seconds")]
    public int MinStaySeconds { get; init; }

    [JsonPropertyName("version")]
    public string Version { get; init; } = "1";
}

public sealed class SiteComplianceConfig
{
    [JsonPropertyName("enabled")]
    public bool Enabled { get; init; }

    [JsonPropertyName("icp_number")]
    public string IcpNumber { get; init; } = string.Empty;

    [JsonPropertyName("public_security_number")]
    public string PublicSecurityNumber { get; init; } = string.Empty;
}

public sealed class MaintenanceModeConfig
{
    [JsonPropertyName("enabled")]
    public bool Enabled { get; init; }

    [JsonPropertyName("expected_end_time")]
    public string? ExpectedEndTime { get; init; }

    [JsonPropertyName("message")]
    public string Message { get; init; } = string.Empty;

    [JsonPropertyName("version")]
    public string Version { get; init; } = "1";
}

