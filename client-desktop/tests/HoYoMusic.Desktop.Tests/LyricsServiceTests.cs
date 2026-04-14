using System.Net;
using System.Text;
using HoYoMusic.Desktop.Core.Contracts;
using HoYoMusic.Desktop.Infrastructure.Services;

namespace HoYoMusic.Desktop.Tests;

public class LyricsServiceTests
{
    [Fact]
    public async Task GetLyricsAsync_ReturnsLyricsAndStatus()
    {
        const string json = """
        {
          "success": true,
          "data": {
            "lyrics": "line1\\nline2",
            "lyrics_status": "has",
            "lyrics_path": "lyrics/1.lrc"
          }
        }
        """;

        var service = new LyricsService(new HttpClient(new StubHttpMessageHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json"),
            }))
            { BaseAddress = new Uri("https://music.hoyodb.com/api/") });

        var result = await service.GetLyricsAsync(1);

        Assert.Equal("has", result.LyricsStatus);
        Assert.Contains("line1", result.Lyrics);
    }

    [Fact]
    public async Task GetLyricsAsync_WhenError_ThrowsApiException()
    {
        const string json = """
        {
          "success": false,
          "error": {
            "code": "NO_LYRICS",
            "message": "No lyrics"
          }
        }
        """;

        var service = new LyricsService(new HttpClient(new StubHttpMessageHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.NotFound)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json"),
            }))
            { BaseAddress = new Uri("https://music.hoyodb.com/api/") });

        var ex = await Assert.ThrowsAsync<ApiException>(() => service.GetLyricsAsync(1));

        Assert.Equal("NO_LYRICS", ex.Code);
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

