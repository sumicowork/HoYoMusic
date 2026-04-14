using System.Net;
using System.Text;
using HoYoMusic.Desktop.Core.Abstractions;
using HoYoMusic.Desktop.Core.Contracts;
using HoYoMusic.Desktop.Core.Models;
using HoYoMusic.Desktop.Infrastructure.Services;

namespace HoYoMusic.Desktop.Tests;

public class AuthServiceTests
{
    [Fact]
    public async Task SendRegistrationVerificationCodeAsync_ReturnsChallengeId()
    {
        const string payload = """
        {
          "success": true,
          "data": {
            "message": "sent",
            "verification_challenge_id": "16d0cde2-2f96-4d40-9c93-57f7cbb58b6f"
          }
        }
        """;

        var service = new AuthService(new HttpClient(new StubHttpMessageHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(payload, Encoding.UTF8, "application/json"),
            }))
        {
            BaseAddress = new Uri("https://music.hoyodb.com/api/"),
        }, new TrackingTokenStore(null));

        var challengeId = await service.SendRegistrationVerificationCodeAsync(new SendVerificationCodeRequest
        {
            Email = "user@example.com",
        });

        Assert.Equal("16d0cde2-2f96-4d40-9c93-57f7cbb58b6f", challengeId);
    }

    [Fact]
    public async Task RegisterAsync_SavesTokenAndReturnsUser()
    {
        const string payload = """
        {
          "success": true,
          "data": {
            "token": "new-token",
            "user": {
              "id": 7,
              "username": "new_user",
              "email": "user@example.com",
              "email_verified": true,
              "is_admin": false,
              "account_status": "active"
            }
          }
        }
        """;

        var tokenStore = new TrackingTokenStore(null);
        var service = new AuthService(new HttpClient(new StubHttpMessageHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.Created)
            {
                Content = new StringContent(payload, Encoding.UTF8, "application/json"),
            }))
        {
            BaseAddress = new Uri("https://music.hoyodb.com/api/"),
        }, tokenStore);

        var session = await service.RegisterAsync(new RegisterRequest
        {
            Username = "new_user",
            Email = "user@example.com",
            VerificationChallengeId = "challenge",
            VerificationCode = "123456",
            Password = "pass1234",
            ConfirmPassword = "pass1234",
        });

        Assert.Equal("new-token", session.Token);
        Assert.Equal("new_user", session.User?.Username);
        Assert.Equal("new-token", tokenStore.CurrentToken);
    }

    [Fact]
    public async Task GetCurrentUserAsync_Unauthorized_ClearsTokenAndThrowsUnauthorized()
    {
        var tokenStore = new TrackingTokenStore("cached-token");
        var handler = new StubHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.Unauthorized));
        var service = new AuthService(new HttpClient(handler)
        {
            BaseAddress = new Uri("https://music.hoyodb.com/api/"),
        }, tokenStore);

        var ex = await Assert.ThrowsAsync<ApiException>(() => service.GetCurrentUserAsync());

        Assert.Equal("UNAUTHORIZED", ex.Code);
        Assert.Equal(1, tokenStore.ClearCount);
        Assert.Equal("cached-token", tokenStore.InitialToken);
    }

    private sealed class StubHttpMessageHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, HttpResponseMessage> _handler;

        public StubHttpMessageHandler(Func<HttpRequestMessage, HttpResponseMessage> handler)
        {
            _handler = handler;
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            => Task.FromResult(_handler(request));
    }

    private sealed class TrackingTokenStore : ITokenStore
    {
        public TrackingTokenStore(string? token)
        {
            InitialToken = token;
            CurrentToken = token;
        }

        public string? InitialToken { get; }
        public string? CurrentToken { get; private set; }
        public int ClearCount { get; private set; }

        public Task SaveTokenAsync(string token, CancellationToken cancellationToken = default)
        {
            CurrentToken = token;
            return Task.CompletedTask;
        }

        public Task<string?> GetTokenAsync(CancellationToken cancellationToken = default)
            => Task.FromResult(CurrentToken);

        public Task ClearTokenAsync(CancellationToken cancellationToken = default)
        {
            ClearCount++;
            CurrentToken = null;
            return Task.CompletedTask;
        }
    }
}

