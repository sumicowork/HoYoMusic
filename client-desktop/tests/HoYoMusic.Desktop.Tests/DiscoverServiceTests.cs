using System.Net;
using System.Text;
using HoYoMusic.Desktop.Core.Contracts;
using HoYoMusic.Desktop.Infrastructure.Services;

namespace HoYoMusic.Desktop.Tests;

public class DiscoverServiceTests
{
    [Fact]
    public async Task GetRandomAlbumsAsync_ClampsCountAndAppendsGameId()
    {
        var seenUris = new List<Uri>();
        const string json = """
        {
          "success": true,
          "data": {
            "albums": [
              {
                "id": 10,
                "title": "Album X",
                "cover_path": "/uploads/covers/x.jpg",
                "track_count": 9,
                "game_name": "Genshin"
              }
            ]
          }
        }
        """;

        var service = new DiscoverService(new HttpClient(new StubHttpMessageHandler(request =>
        {
            if (request.RequestUri is not null)
            {
                seenUris.Add(request.RequestUri);
            }

            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json"),
            };
        }))
        {
            BaseAddress = new Uri("https://music.hoyodb.com/api/"),
        });

        var albums = await service.GetRandomAlbumsAsync(count: 99, gameId: 7);

        Assert.Single(albums);
        Assert.Single(seenUris);
        Assert.Equal("/api/public/albums/random", seenUris[0].AbsolutePath);
        Assert.Equal("?count=20&game_id=7", seenUris[0].Query);
    }

    [Fact]
    public async Task GetRandomTracksAsync_WhenApiFails_ThrowsApiExceptionWithCode()
    {
        const string json = """
        {
          "success": false,
          "error": {
            "code": "FETCH_ERROR",
            "message": "boom"
          }
        }
        """;

        var service = new DiscoverService(new HttpClient(new StubHttpMessageHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.InternalServerError)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json"),
            }))
        {
            BaseAddress = new Uri("https://music.hoyodb.com/api/"),
        });

        var ex = await Assert.ThrowsAsync<ApiException>(() => service.GetRandomTracksAsync());

        Assert.Equal("FETCH_ERROR", ex.Code);
    }

    [Fact]
    public async Task GetTopTracksAsync_ClampsLimitTo100()
    {
        var seenUris = new List<Uri>();
        const string json = """
        {
          "success": true,
          "data": {
            "tracks": [
              {
                "id": 1,
                "title": "Track A",
                "duration": 180,
                "play_count": 1000
              }
            ]
          }
        }
        """;

        var service = new DiscoverService(new HttpClient(new StubHttpMessageHandler(request =>
        {
            if (request.RequestUri is not null)
            {
                seenUris.Add(request.RequestUri);
            }

            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json"),
            };
        }))
        {
            BaseAddress = new Uri("https://music.hoyodb.com/api/"),
        });

        var tracks = await service.GetTopTracksAsync(count: 999, gameId: 3);

        Assert.Single(tracks);
        Assert.Single(seenUris);
        Assert.Equal("/api/public/top-tracks", seenUris[0].AbsolutePath);
        Assert.Equal("?limit=100&game_id=3", seenUris[0].Query);
    }

    [Fact]
    public async Task GetRandomAlbumsAsync_ClampsCountToOneAndSkipsInvalidGameId()
    {
        var seenUris = new List<Uri>();
        const string json = """
        {
          "success": true,
          "data": {
            "albums": []
          }
        }
        """;

        var service = new DiscoverService(new HttpClient(new StubHttpMessageHandler(request =>
        {
            if (request.RequestUri is not null)
            {
                seenUris.Add(request.RequestUri);
            }

            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json"),
            };
        }))
        {
            BaseAddress = new Uri("https://music.hoyodb.com/api/"),
        });

        var albums = await service.GetRandomAlbumsAsync(count: -5, gameId: 0);

        Assert.Empty(albums);
        Assert.Single(seenUris);
        Assert.Equal("?count=1", seenUris[0].Query);
    }

    [Fact]
    public async Task GetRandomTracksAsync_WhenStatusCodeFailsEvenIfEnvelopeSuccess_ThrowsApiException()
    {
        const string json = """
        {
          "success": true,
          "data": {
            "tracks": []
          }
        }
        """;

        var service = new DiscoverService(new HttpClient(new StubHttpMessageHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.InternalServerError)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json"),
            }))
        {
            BaseAddress = new Uri("https://music.hoyodb.com/api/"),
        });

        var ex = await Assert.ThrowsAsync<ApiException>(() => service.GetRandomTracksAsync());

        Assert.Equal("Failed to load random tracks.", ex.Message);
    }

    [Fact]
    public async Task GetTopTracksAsync_WhenEnvelopeMissingData_ThrowsFallbackApiException()
    {
        const string json = """
        {
          "success": true,
          "data": null
        }
        """;

        var service = new DiscoverService(new HttpClient(new StubHttpMessageHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json"),
            }))
        {
            BaseAddress = new Uri("https://music.hoyodb.com/api/"),
        });

        var ex = await Assert.ThrowsAsync<ApiException>(() => service.GetTopTracksAsync());

        Assert.Equal("Failed to load top tracks.", ex.Message);
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


