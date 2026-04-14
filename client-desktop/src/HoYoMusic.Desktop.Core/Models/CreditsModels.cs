using System.Text.Json.Serialization;

namespace HoYoMusic.Desktop.Core.Models;

public sealed class CreditItem
{
    [JsonPropertyName("id")]
    public int Id { get; init; }

    [JsonPropertyName("credit_key")]
    public string CreditKey { get; init; } = string.Empty;

    [JsonPropertyName("credit_value")]
    public string CreditValue { get; init; } = string.Empty;

    [JsonPropertyName("display_order")]
    public int DisplayOrder { get; init; }

    [JsonIgnore]
    public string DisplayText => $"{CreditKey}: {CreditValue}";
}

public sealed class CreditsResponseData
{
    [JsonPropertyName("credits")]
    public IReadOnlyList<CreditItem> Credits { get; init; } = Array.Empty<CreditItem>();
}

