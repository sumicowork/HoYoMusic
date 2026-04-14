using System.Text.Json.Serialization;

namespace HoYoMusic.Desktop.Core.Models;

public sealed class LoginRequest
{
    public string Identifier { get; init; } = string.Empty;
    public string Password { get; init; } = string.Empty;
}

public sealed class SendVerificationCodeRequest
{
    public string Email { get; init; } = string.Empty;
}

public sealed class RegisterRequest
{
    public string Username { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
    public string VerificationChallengeId { get; init; } = string.Empty;
    public string VerificationCode { get; init; } = string.Empty;
    public string Password { get; init; } = string.Empty;
    public string ConfirmPassword { get; init; } = string.Empty;
}

public sealed class LoginResponseData
{
    [JsonPropertyName("token")]
    public string Token { get; init; } = string.Empty;

    [JsonPropertyName("user")]
    public AuthUser? User { get; init; }
}

public sealed class AuthUser
{
    [JsonPropertyName("id")]
    public int Id { get; init; }

    [JsonPropertyName("username")]
    public string Username { get; init; } = string.Empty;

    [JsonPropertyName("email")]
    public string? Email { get; init; }

    [JsonPropertyName("email_verified")]
    public bool EmailVerified { get; init; }

    [JsonPropertyName("is_admin")]
    public bool IsAdmin { get; init; }

    [JsonPropertyName("account_status")]
    public string? AccountStatus { get; init; }
}

public sealed class ChangePasswordRequest
{
    public string CurrentPassword { get; init; } = string.Empty;
    public string NewPassword { get; init; } = string.Empty;
}

public sealed class CurrentUserResponseData
{
    [JsonPropertyName("user")]
    public AuthUser? User { get; init; }
}

public sealed class SendVerificationCodeResponseData
{
    [JsonPropertyName("message")]
    public string? Message { get; init; }

    [JsonPropertyName("verification_challenge_id")]
    public string? VerificationChallengeId { get; init; }
}

public sealed class AuthSession
{
    public string Token { get; init; } = string.Empty;
    public AuthUser? User { get; init; }
}
