namespace HoYoMusic.Desktop.Core.Contracts;

public static class ApiErrorMapper
{
    private static readonly HashSet<string> ReauthenticationCodes = new(StringComparer.OrdinalIgnoreCase)
    {
        "UNAUTHORIZED",
        "MISSING_TOKEN",
    };

    private static readonly IReadOnlyDictionary<string, string> FriendlyMessages = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
    {
        ["UNAUTHORIZED"] = "登录状态已过期，请重新登录。",
        ["MISSING_TOKEN"] = "请先登录后再继续操作。",
        ["INVALID_CREDENTIALS"] = "账号或密码错误。",
        ["FORBIDDEN"] = "当前账号没有权限执行该操作。",
        ["NOT_FOUND"] = "请求的内容不存在。",
        ["RATE_LIMITED"] = "请求过于频繁，请稍后再试。",
    };

    public static string Resolve(ApiException exception, string fallbackMessage)
    {
        if (!string.IsNullOrWhiteSpace(exception.Code) && FriendlyMessages.TryGetValue(exception.Code!, out var mappedMessage))
        {
            return mappedMessage;
        }

        if (ShouldPreferFallback(exception.Message))
        {
            return fallbackMessage;
        }

        return exception.Message;
    }

    public static bool ShouldClearSession(ApiException exception)
        => !string.IsNullOrWhiteSpace(exception.Code) && ReauthenticationCodes.Contains(exception.Code!);

    private static bool ShouldPreferFallback(string? message)
    {
        if (string.IsNullOrWhiteSpace(message))
        {
            return true;
        }

        return message.StartsWith("Failed to", StringComparison.OrdinalIgnoreCase)
            || message.StartsWith("Login failed", StringComparison.OrdinalIgnoreCase)
            || message.StartsWith("Session expired", StringComparison.OrdinalIgnoreCase)
            || message.StartsWith("Not authenticated", StringComparison.OrdinalIgnoreCase)
            || message.StartsWith("Unable to", StringComparison.OrdinalIgnoreCase);
    }
}
