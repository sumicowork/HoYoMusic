using HoYoMusic.Desktop.Core.Abstractions;
using HoYoMusic.Desktop.Core.Contracts;
using HoYoMusic.Desktop.Infrastructure.Services;
using System.Net;
using System.Text;
using System.Text.Json;

namespace HoYoMusic.Desktop.Tests;

public class TrackServiceTests
{
    [Fact]
    public void BuildPublicStreamUri_ReturnsExpectedPath()
    {
        var service = new TrackService(new HttpClient(), new FakeTokenStore("token"));

        var uri = service.BuildPublicStreamUri(123);

        Assert.Equal("https://music.hoyodb.com/api/public/tracks/123/stream", uri.ToString());
    }

    [Fact]
    public async Task GetTracksAsync_WithoutToken_ThrowsApiException()
    {
        var service = new TrackService(new HttpClient(), new FakeTokenStore(null));

        var ex = await Assert.ThrowsAsync<ApiException>(() => service.GetTracksAsync());

        Assert.Equal("MISSING_TOKEN", ex.Code);
    }

    [Fact]
    public async Task GetTracksAsync_WhenUnauthorized_ClearsTokenAndThrowsApiException()
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
        var service = new TrackService(new HttpClient(new StubHttpMessageHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.Unauthorized)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json"),
            }))
        {
            BaseAddress = new Uri("https://music.hoyodb.com/api/"),
        }, tokenStore);

        var ex = await Assert.ThrowsAsync<ApiException>(() => service.GetTracksAsync());

        Assert.Equal("UNAUTHORIZED", ex.Code);
        Assert.Equal(1, tokenStore.ClearCount);
    }

    [Fact]
    public async Task GetTracksAsync_ClampsPageAndLimitAndBuildsGameIdsQuery()
    {
        var seenUris = new List<Uri>();
        const string json = """
        {
          "success": true,
          "data": {
            "tracks": []
          }
        }
        """;

        var service = new TrackService(new HttpClient(new StubHttpMessageHandler(request =>
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
            { BaseAddress = new Uri("https://music.hoyodb.com/api/") },
            new FakeTokenStore("token"));

        var tracks = await service.GetTracksAsync(page: -5, limit: 500, gameIds: [4, 4, 0, 9]);

        Assert.Empty(tracks);
        Assert.Single(seenUris);
        Assert.Equal("/api/tracks", seenUris[0].AbsolutePath);
        Assert.Equal("?page=1&limit=100&game_ids=4,9", seenUris[0].Query);
    }

    [Fact]
    public async Task GetPublicTracksAsync_ClampsPagingAndEncodesSearch()
    {
        var seenUris = new List<Uri>();
        const string json = """
        {
          "success": true,
          "data": {
            "tracks": [
              {
                "id": 1,
                "title": "A",
                "duration": 120,
                "artists": []
              }
            ]
          }
        }
        """;

        var service = new TrackService(new HttpClient(new StubHttpMessageHandler(request =>
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
            { BaseAddress = new Uri("https://music.hoyodb.com/api/") },
            new FakeTokenStore("token"));

        var result = await service.GetPublicTracksAsync(page: 0, limit: 999, search: "A B", gameIds: [7, 9]);

        Assert.Single(result);
        Assert.Single(seenUris);
        Assert.Equal("/api/public/tracks", seenUris[0].AbsolutePath);
        Assert.Equal("?page=1&limit=100&search=A%20B&game_ids=7,9&sort_by=release_date&sort_dir=DESC", seenUris[0].Query);
    }

    [Fact]
    public async Task GetPublicTrackPageAsync_EncodesAdvancedFiltersAndPagination()
    {
        var seenUris = new List<Uri>();
        const string json = """
        {
          "success": true,
          "data": {
            "tracks": [],
            "pagination": {
              "page": 2,
              "limit": 50,
              "total": 123,
              "totalPages": 3
            }
          }
        }
        """;

        var service = new TrackService(new HttpClient(new StubHttpMessageHandler(request =>
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
            { BaseAddress = new Uri("https://music.hoyodb.com/api/") },
            new FakeTokenStore("token"));

        var page = await service.GetPublicTrackPageAsync(2, 50, new HoYoMusic.Desktop.Core.Models.TrackQueryOptions
        {
            Search = "battle",
            Artist = "陈致逸",
            YearFrom = 2020,
            YearTo = 2026,
            DurationMin = 60,
            DurationMax = 500,
            DurationBucket = "medium",
            LyricsStatus = "has",
            SortBy = "title",
            SortDir = "ASC",
            GameIds = [1, 2],
        });

        Assert.Single(seenUris);
        Assert.Equal("/api/public/tracks", seenUris[0].AbsolutePath);
        Assert.Equal("?page=2&limit=50&search=battle&game_ids=1,2&artist=%E9%99%88%E8%87%B4%E9%80%B8&year_from=2020&year_to=2026&duration_min=60&duration_max=500&duration_bucket=medium&lyrics_status=has&sort_by=title&sort_dir=ASC", seenUris[0].Query);
        Assert.Equal(2, page.Pagination?.Page);
        Assert.Equal(3, page.Pagination?.TotalPages);
    }

    [Fact]
    public async Task GetPublicTrackByIdAsync_WhenNotFound_ThrowsApiExceptionWithCode()
    {
        const string json = """
        {
          "success": false,
          "error": {
            "code": "NOT_FOUND",
            "message": "track missing"
          }
        }
        """;

        var service = new TrackService(new HttpClient(new StubHttpMessageHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.NotFound)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json"),
            }))
            { BaseAddress = new Uri("https://music.hoyodb.com/api/") },
            new FakeTokenStore("token"));

        var ex = await Assert.ThrowsAsync<ApiException>(() => service.GetPublicTrackByIdAsync(88));

        Assert.Equal("NOT_FOUND", ex.Code);
    }

    [Fact]
    public async Task GetPublicTrackByIdAsync_WhenMalformedJson_ThrowsFallbackMessage()
    {
        var service = new TrackService(new HttpClient(new StubHttpMessageHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("<html>bad</html>", Encoding.UTF8, "text/html"),
            }))
            { BaseAddress = new Uri("https://music.hoyodb.com/api/") },
            new FakeTokenStore("token"));

        var ex = await Assert.ThrowsAsync<ApiException>(() => service.GetPublicTrackByIdAsync(12));

        Assert.Equal("Failed to load track detail.", ex.Message);
    }

    [Fact]
    public async Task RecordPlayAsync_SendsExpectedPayload()
    {
        string? sentBody = null;
        var service = new TrackService(new HttpClient(new StubHttpMessageHandler(async request =>
            {
                sentBody = request.Content is null ? null : await request.Content.ReadAsStringAsync();
                return new HttpResponseMessage(HttpStatusCode.OK);
            }))
            { BaseAddress = new Uri("https://music.hoyodb.com/api/") },
            new FakeTokenStore("token"));

        await service.RecordPlayAsync(trackId: 18, playedSeconds: -3, trackDurationSeconds: 220, sessionKey: "abc");

        Assert.False(string.IsNullOrWhiteSpace(sentBody));
        using var doc = JsonDocument.Parse(sentBody!);
        Assert.Equal(0, doc.RootElement.GetProperty("played_seconds").GetInt32());
        Assert.Equal(220, doc.RootElement.GetProperty("track_duration_seconds").GetInt32());
        Assert.Equal("abc", doc.RootElement.GetProperty("session_key").GetString());
    }

    [Fact]
    public async Task RecordPlayAsync_WhenErrorEnvelopeMissing_ThrowsFallbackMessage()
    {
        var service = new TrackService(new HttpClient(new StubHttpMessageHandler(_ =>
            new HttpResponseMessage(HttpStatusCode.InternalServerError)
            {
                Content = new StringContent("{}", Encoding.UTF8, "application/json"),
            }))
            { BaseAddress = new Uri("https://music.hoyodb.com/api/") },
            new FakeTokenStore("token"));

        var ex = await Assert.ThrowsAsync<ApiException>(() => service.RecordPlayAsync(11, 10, 180));

        Assert.Equal("Failed to record play event.", ex.Message);
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
        private readonly Func<HttpRequestMessage, Task<HttpResponseMessage>> _handler;

        public StubHttpMessageHandler(Func<HttpRequestMessage, HttpResponseMessage> handler)
        {
            _handler = request => Task.FromResult(handler(request));
        }

        public StubHttpMessageHandler(Func<HttpRequestMessage, Task<HttpResponseMessage>> handler)
        {
            _handler = handler;
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            => _handler(request);
    }
}

