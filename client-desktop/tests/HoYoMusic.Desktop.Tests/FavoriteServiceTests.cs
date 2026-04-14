using HoYoMusic.Desktop.Core.Abstractions;
using HoYoMusic.Desktop.Core.Contracts;
using HoYoMusic.Desktop.Infrastructure.Services;
using System.Net;
using System.Text;

namespace HoYoMusic.Desktop.Tests;

public class FavoriteServiceTests
{
    [Fact]
    public async Task ToggleAsync_WithoutToken_ThrowsApiException()
    {
        var service = new FavoriteService(new HttpClient(), new FakeTokenStore(null));

        var ex = await Assert.ThrowsAsync<ApiException>(() => service.ToggleAsync(1));

        Assert.Equal("MISSING_TOKEN", ex.Code);
    }

    [Fact]
    public async Task GetFavoritesAsync_WhenUnauthorized_ClearsTokenAndThrowsApiException()
    {
        const string json = """
        {
          "success": false,
          "error": {
            "code": "UNAUTHORIZED",
            "message": "token expired"
          }
        }
        """;

        var tokenStore = new TrackingTokenStore("token");
        var service = new FavoriteService(new HttpClient(new StubHttpMessageHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.Unauthorized)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json"),
            }))
        {
            BaseAddress = new Uri("https://music.hoyodb.com/api/"),
        }, tokenStore);

        var ex = await Assert.ThrowsAsync<ApiException>(() => service.GetFavoritesAsync());

        Assert.Equal("UNAUTHORIZED", ex.Code);
        Assert.Equal(1, tokenStore.ClearCount);
    }

    [Fact]
    public async Task CheckFavoritesAsync_WhenUnauthorized_ClearsTokenAndThrowsApiException()
    {
        const string json = """
        {
          "success": false,
          "error": {
            "code": "UNAUTHORIZED",
            "message": "token expired"
          }
        }
        """;

        var tokenStore = new TrackingTokenStore("token");
        var service = new FavoriteService(new HttpClient(new StubHttpMessageHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.Unauthorized)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json"),
            }))
        {
            BaseAddress = new Uri("https://music.hoyodb.com/api/"),
        }, tokenStore);

        var ex = await Assert.ThrowsAsync<ApiException>(() => service.CheckFavoritesAsync([1, 2]));

        Assert.Equal("UNAUTHORIZED", ex.Code);
        Assert.Equal(1, tokenStore.ClearCount);
    }

    [Fact]
    public async Task ToggleAsync_WhenMalformedJson_ThrowsFallbackMessage()
    {
        var service = new FavoriteService(new HttpClient(new StubHttpMessageHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.InternalServerError)
            {
                Content = new StringContent("<html>bad</html>", Encoding.UTF8, "text/html"),
            }))
        {
            BaseAddress = new Uri("https://music.hoyodb.com/api/"),
        }, new TrackingTokenStore("token"));

        var ex = await Assert.ThrowsAsync<ApiException>(() => service.ToggleAsync(1));

        Assert.Equal("Failed to toggle favorite.", ex.Message);
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

    private sealed class TrackingTokenStore : ITokenStore
    {
        private string? _token;

        public TrackingTokenStore(string? token)
        {
            _token = token;
        }

        public int ClearCount { get; private set; }

        public Task SaveTokenAsync(string token, CancellationToken cancellationToken = default)
        {
            _token = token;
            return Task.CompletedTask;
        }

        public Task<string?> GetTokenAsync(CancellationToken cancellationToken = default)
            => Task.FromResult(_token);

        public Task ClearTokenAsync(CancellationToken cancellationToken = default)
        {
            _token = null;
            ClearCount++;
            return Task.CompletedTask;
        }
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

