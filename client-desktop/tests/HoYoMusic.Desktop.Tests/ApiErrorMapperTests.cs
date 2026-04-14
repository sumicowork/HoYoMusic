using HoYoMusic.Desktop.Core.Contracts;

namespace HoYoMusic.Desktop.Tests;

public class ApiErrorMapperTests
{
    [Fact]
    public void Resolve_InvalidCredentials_UsesFriendlyChineseMessage()
    {
        var exception = new ApiException("Login failed.", "INVALID_CREDENTIALS");

        var message = HoYoMusic.Desktop.Core.Contracts.ApiErrorMapper.Resolve(exception, "登录失败，请稍后重试。");

        Assert.Equal("账号或密码错误。", message);
    }

    [Fact]
    public void ShouldClearSession_UnauthorizedAndMissingToken_ReturnTrue()
    {
        Assert.True(HoYoMusic.Desktop.Core.Contracts.ApiErrorMapper.ShouldClearSession(new ApiException("Session expired.", "UNAUTHORIZED")));
        Assert.True(HoYoMusic.Desktop.Core.Contracts.ApiErrorMapper.ShouldClearSession(new ApiException("Not authenticated.", "MISSING_TOKEN")));
    }
}

