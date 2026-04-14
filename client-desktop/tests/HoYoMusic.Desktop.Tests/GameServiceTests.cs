using System.Net;
using System.Net.Http;
using System.Text;
using HoYoMusic.Desktop.Core.Contracts;
using HoYoMusic.Desktop.Infrastructure.Services;

namespace HoYoMusic.Desktop.Tests;

public class GameServiceTests
{
    [Fact]
    public async Task GetGamesAsync_ReturnsRemoteGames()
    {
        var json = """
        {
          "success": true,
          "data": {
            "games": [
              {
                "id": 7,
                "name": "Genshin",
                "name_en": "Genshin Impact",
                "cover_path": "/games/genshin.png",
                "status": "active",
                "album_count": "12"
              }
            ]
          }
        }
        """;

        var client = new HttpClient(new StubHttpMessageHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json"),
            }))
        {
            BaseAddress = new Uri("https://music.hoyodb.com/api/"),
        };

        var service = new GameService(client);
        var games = await service.GetGamesAsync();

        Assert.Single(games);
        Assert.Equal(7, games[0].Id);
        Assert.Equal("Genshin Impact", games[0].DisplayName);
        Assert.Equal(12, games[0].AlbumCount);
        Assert.Equal("https://music.hoyodb.com/games/genshin.png", games[0].CoverPath);
    }

    [Fact]
    public async Task GetGamesAsync_ProxiesAbsoluteCoverPath()
    {
        var json = """
        {
          "success": true,
          "data": {
            "games": [
              {
                "id": 8,
                "name": "HG2",
                "cover_path": "https://example.com/covers/hg2.jpg",
                "status": "active",
                "album_count": "9"
              }
            ]
          }
        }
        """;

        var client = new HttpClient(new StubHttpMessageHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json"),
            }))
        {
            BaseAddress = new Uri("https://music.hoyodb.com/api/"),
        };

        var service = new GameService(client);
        var games = await service.GetGamesAsync();

        Assert.Single(games);
        Assert.Equal(
            "https://music.hoyodb.com/api/public/covers/proxy?path=https%3A%2F%2Fexample.com%2Fcovers%2Fhg2.jpg",
            games[0].CoverPath);
    }

    [Fact]
    public async Task GetGamesAsync_WhenApiReturnsFailure_ThrowsApiException()
    {
        var json = """
        {
          "success": false,
          "error": {
            "code": "FETCH_ERROR",
            "message": "Failed to load games"
          }
        }
        """;

        var client = new HttpClient(new StubHttpMessageHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.InternalServerError)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json"),
            }))
        {
            BaseAddress = new Uri("https://music.hoyodb.com/api/"),
        };

        var service = new GameService(client);

        var ex = await Assert.ThrowsAsync<ApiException>(() => service.GetGamesAsync());

        Assert.Equal("FETCH_ERROR", ex.Code);
    }

    [Fact]
    public async Task GetGameAlbumsAsync_ReturnsAlbumsForSelectedGame()
    {
        var json = """
        {
          "success": true,
          "data": {
            "albums": [
              {
                "id": 1001,
                "title": "Album A",
                "cover_path": "/uploads/covers/a.jpg",
                "track_count": "19"
              }
            ]
          }
        }
        """;

        var client = new HttpClient(new StubHttpMessageHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json"),
            }))
        {
            BaseAddress = new Uri("https://music.hoyodb.com/api/"),
        };

        var service = new GameService(client);
        var albums = await service.GetGameAlbumsAsync(3);

        Assert.Single(albums);
        Assert.Equal("Album A", albums[0].Title);
        Assert.Equal(19, albums[0].TrackCount);
        Assert.Equal("https://music.hoyodb.com/uploads/covers/a.jpg", albums[0].CoverPath);
    }

    [Fact]
    public async Task GetGamesAsync_WithMalformedCoverPath_DoesNotFailWholeList()
    {
        var json = """
        {
          "success": true,
          "data": {
            "games": [
              {
                "id": 1,
                "name": "BadCover",
                "cover_path": "http://%",
                "status": "active",
                "album_count": "1"
              },
              {
                "id": 2,
                "name": "GoodCover",
                "cover_path": "/games/good.png",
                "status": "active",
                "album_count": "2"
              }
            ]
          }
        }
        """;

        var client = new HttpClient(new StubHttpMessageHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json"),
            }))
        {
            BaseAddress = new Uri("https://music.hoyodb.com/api/"),
        };

        var service = new GameService(client);
        var games = await service.GetGamesAsync();

        Assert.Equal(2, games.Count);
        Assert.False(string.IsNullOrWhiteSpace(games[0].CoverPath));
        Assert.Equal("https://music.hoyodb.com/games/good.png", games[1].CoverPath);
    }

    private sealed class StubHttpMessageHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, HttpResponseMessage> _handler;

        public StubHttpMessageHandler(Func<HttpRequestMessage, HttpResponseMessage> handler)
        {
            _handler = handler;
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            return Task.FromResult(_handler(request));
        }
    }
}


