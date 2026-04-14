using System.Net;
using System.Text;
using HoYoMusic.Desktop.Core.Contracts;
using HoYoMusic.Desktop.Infrastructure.Services;

namespace HoYoMusic.Desktop.Tests;

public class AlbumServiceTests
{
    [Fact]
    public async Task GetAlbumByIdAsync_Success_ReturnsAlbumAndTracks()
    {
        var seenUris = new List<Uri>();
        const string json = """
        {
          "success": true,
          "data": {
            "album": {
              "id": 100,
              "title": "Album A",
              "cover_path": "/uploads/covers/a.jpg",
              "track_count": "2",
              "total_duration": "360"
            },
            "tracks": [
              {
                "id": 1,
                "title": "Track 1",
                "duration": 180,
                "artists": [
                  { "id": 1, "name": "Artist A" }
                ]
              },
              {
                "id": 2,
                "title": "Track 2",
                "duration": 180,
                "artists": [
                  { "id": 2, "name": "Artist B" }
                ]
              }
            ],
            "discs": [
              { "id": 1, "disc_number": 1, "disc_title": "Disc 1" }
            ]
          }
        }
        """;

        var service = new AlbumService(new HttpClient(new StubHttpMessageHandler(request =>
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

        var result = await service.GetAlbumByIdAsync(100);

        Assert.Equal(100, result.Album.Id);
        Assert.Equal("Album A", result.Album.Title);
        Assert.Equal(2, result.Tracks.Count);
        Assert.Single(result.Discs);
        Assert.Single(seenUris);
        Assert.Equal("/api/albums/100", seenUris[0].AbsolutePath);
    }

    [Fact]
    public async Task GetAlbumByIdAsync_WhenNotFound_ThrowsApiExceptionWithCode()
    {
        const string json = """
        {
          "success": false,
          "error": {
            "code": "NOT_FOUND",
            "message": "album not found"
          }
        }
        """;

        var service = new AlbumService(new HttpClient(new StubHttpMessageHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.NotFound)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json"),
            }))
        {
            BaseAddress = new Uri("https://music.hoyodb.com/api/"),
        });

        var ex = await Assert.ThrowsAsync<ApiException>(() => service.GetAlbumByIdAsync(404));

        Assert.Equal("NOT_FOUND", ex.Code);
    }

    [Fact]
    public async Task GetAlbumByIdAsync_WhenAlbumMissing_ThrowsFallbackMessage()
    {
        const string json = """
        {
          "success": true,
          "data": {
            "tracks": [],
            "discs": []
          }
        }
        """;

        var service = new AlbumService(new HttpClient(new StubHttpMessageHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json"),
            }))
        {
            BaseAddress = new Uri("https://music.hoyodb.com/api/"),
        });

        var ex = await Assert.ThrowsAsync<ApiException>(() => service.GetAlbumByIdAsync(200));

        Assert.Equal("Failed to load album details.", ex.Message);
    }

    [Fact]
    public async Task GetAlbumByIdAsync_WhenEnvelopeMalformed_ThrowsFallbackMessage()
    {
        var service = new AlbumService(new HttpClient(new StubHttpMessageHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("{}", Encoding.UTF8, "application/json"),
            }))
        {
            BaseAddress = new Uri("https://music.hoyodb.com/api/"),
        });

        var ex = await Assert.ThrowsAsync<ApiException>(() => service.GetAlbumByIdAsync(300));

        Assert.Equal("Failed to load album details.", ex.Message);
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


