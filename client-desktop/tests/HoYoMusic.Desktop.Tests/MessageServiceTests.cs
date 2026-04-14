using System.Net;
using System.Text;
using HoYoMusic.Desktop.Core.Abstractions;
using HoYoMusic.Desktop.Core.Contracts;
using HoYoMusic.Desktop.Infrastructure.Services;

namespace HoYoMusic.Desktop.Tests;

public class MessageServiceTests
{
    [Fact]
    public async Task GetUnreadCountAsync_ReturnsUnreadNumber()
    {
        const string json = """
        {
          "success": true,
          "data": {
            "unread": 5
          }
        }
        """;

        var service = new MessageService(
            new HttpClient(new StubHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json"),
            })) { BaseAddress = new Uri("https://music.hoyodb.com/api/") },
            new FakeTokenStore("token"));

        var unread = await service.GetUnreadCountAsync();

        Assert.Equal(5, unread);
    }

    [Fact]
    public async Task GetInboxMessagesAsync_WithoutToken_ThrowsMissingToken()
    {
        var service = new MessageService(new HttpClient(), new FakeTokenStore(null));

        var ex = await Assert.ThrowsAsync<ApiException>(() => service.GetInboxMessagesAsync());

        Assert.Equal("MISSING_TOKEN", ex.Code);
    }

    private sealed class FakeTokenStore : ITokenStore
    {
        private readonly string? _token;

        public FakeTokenStore(string? token)
        {
            _token = token;
        }

        public Task SaveTokenAsync(string token, CancellationToken cancellationToken = default)
            => Task.CompletedTask;

        public Task<string?> GetTokenAsync(CancellationToken cancellationToken = default)
            => Task.FromResult(_token);

        public Task ClearTokenAsync(CancellationToken cancellationToken = default)
            => Task.CompletedTask;
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
}

