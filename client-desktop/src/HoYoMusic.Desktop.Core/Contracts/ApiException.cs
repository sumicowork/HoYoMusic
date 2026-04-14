namespace HoYoMusic.Desktop.Core.Contracts;

public sealed class ApiException : Exception
{
    public ApiException(string message, string? code = null) : base(message)
    {
        Code = code;
    }

    public string? Code { get; }
}

