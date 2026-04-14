using System.Text.Json.Serialization;

namespace HoYoMusic.Desktop.Core.Models;

public sealed class FavoriteToggleResult
{
    [JsonPropertyName("favorited")]
    public bool Favorited { get; init; }
}

public sealed class FavoriteToggleResponseData
{
    [JsonPropertyName("favorited")]
    public bool Favorited { get; init; }
}

public sealed class FavoriteCheckResponseData
{
    [JsonPropertyName("favorites")]
    public IReadOnlyDictionary<int, bool> Favorites { get; init; } = new Dictionary<int, bool>();
}

