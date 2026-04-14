using System.Net;
using System.Text;
using HoYoMusic.Desktop.Infrastructure.Services;

namespace HoYoMusic.Desktop.Tests;

public class MusicSourceServiceTests
{
    [Fact]
    public async Task GetTrackMusicSourcesAsync_ReturnsItems()
    {
        const string json = """
        {
          "success": true,
          "data": {
            "items": [
              {
                "id": 1,
                "category_name": "OST",
                "node_name": "Main Story",
                "path": ["OST", "Main Story"]
              }
            ]
          }
        }
        """;

        var service = new MusicSourceService(new HttpClient(new StubHttpMessageHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json"),
            }))
            { BaseAddress = new Uri("https://music.hoyodb.com/api/") });

        var items = await service.GetTrackMusicSourcesAsync(8);

        Assert.Single(items);
        Assert.Equal("OST / Main Story", items[0].DisplayText);
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

