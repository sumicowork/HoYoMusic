namespace HoYoMusic.Desktop.Infrastructure.Services;

internal static class StringExtensions
{
    public static string? NullIfWhiteSpace(this string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value;
}
