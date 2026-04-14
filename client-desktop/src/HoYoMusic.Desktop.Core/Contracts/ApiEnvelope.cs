namespace HoYoMusic.Desktop.Core.Contracts;

public sealed class ApiEnvelope<T>
{
    public bool Success { get; init; }
    public T? Data { get; init; }
    public ApiError? Error { get; init; }
}

public sealed class ApiError
{
    public string? Code { get; init; }
    public string? Message { get; init; }
}

