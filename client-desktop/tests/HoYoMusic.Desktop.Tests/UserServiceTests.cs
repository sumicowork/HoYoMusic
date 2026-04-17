using System.Net;
using System.Text;
using HoYoMusic.Desktop.Core.Abstractions;
using HoYoMusic.Desktop.Infrastructure.Services;

namespace HoYoMusic.Desktop.Tests;

public class UserServiceTests
{
    [Fact]
    public async Task GetUsersAsync_ReturnsItems()
    {
        const string json = """
        {
          "success": true,
          "data": {
            "items": [
              { "id": 1, "username": "admin", "email": "a@b.com", "email_verified": true, "is_admin": true, "account_status": "active", "created_at": "2026-01-01T00:00:00.000Z", "updated_at": "2026-01-01T00:00:00.000Z" }
            ],
            "pagination": { "page": 1, "pageSize": 20, "total": 1, "totalPages": 1 }
          }
        }
        """;

        var service = new UserService(
            new HttpClient(new StubHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json"),
            })) { BaseAddress = new Uri("https://music.hoyodb.com/api/") },
            new FakeTokenStore("token"));

        var users = await service.GetUsersAsync();

        Assert.Single(users.Items);
        Assert.Equal("admin", users.Items[0].Username);
    }

    private sealed class FakeTokenStore : ITokenStore
    {
        private readonly string? _token;
        public FakeTokenStore(string? token) => _token = token;
        public Task SaveTokenAsync(string token, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task<string?> GetTokenAsync(CancellationToken cancellationToken = default) => Task.FromResult(_token);
        public Task ClearTokenAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
    }

    private sealed class StubHttpMessageHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, HttpResponseMessage> _handler;
        public StubHttpMessageHandler(Func<HttpRequestMessage, HttpResponseMessage> handler) => _handler = handler;
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            => Task.FromResult(_handler(request));
    }
}

