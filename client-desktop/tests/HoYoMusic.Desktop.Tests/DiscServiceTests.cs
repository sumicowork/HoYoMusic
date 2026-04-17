using System.Net;
using System.Text;
using HoYoMusic.Desktop.Core.Abstractions;
using HoYoMusic.Desktop.Infrastructure.Services;

namespace HoYoMusic.Desktop.Tests;

public class DiscServiceTests
{
    [Fact]
    public async Task GetDiscsByAlbumAsync_ReturnsDiscs()
    {
        const string json = """
        {
          "success": true,
          "data": {
            "discs": [
              { "id": 10, "album_id": 3, "disc_number": 1, "disc_title": "Disc 1" }
            ]
          }
        }
        """;

        var service = new DiscService(
            new HttpClient(new StubHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json"),
            })) { BaseAddress = new Uri("https://music.hoyodb.com/api/") },
            new FakeTokenStore("token"));

        var discs = await service.GetDiscsByAlbumAsync(3);

        Assert.Single(discs);
        Assert.Equal(10, discs[0].Id);
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

