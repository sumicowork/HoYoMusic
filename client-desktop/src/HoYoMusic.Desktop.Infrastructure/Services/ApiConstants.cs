namespace HoYoMusic.Desktop.Infrastructure.Services;

internal static class ApiConstants
{
    private const string DefaultApiBaseUrl = "https://music.hoyodb.com/api/";

    public static Uri ResolveBaseUri(string? configuredBaseUrl)
    {
        if (!string.IsNullOrWhiteSpace(configuredBaseUrl)
            && Uri.TryCreate(configuredBaseUrl.Trim(), UriKind.Absolute, out var parsed)
            && (parsed.Scheme == Uri.UriSchemeHttp || parsed.Scheme == Uri.UriSchemeHttps))
        {
            return EnsureTrailingSlash(parsed);
        }

        return new Uri(DefaultApiBaseUrl);
    }

    private static Uri EnsureTrailingSlash(Uri uri)
    {
        var value = uri.ToString();
        return value.EndsWith("/", StringComparison.Ordinal) ? uri : new Uri($"{value}/");
    }
}
