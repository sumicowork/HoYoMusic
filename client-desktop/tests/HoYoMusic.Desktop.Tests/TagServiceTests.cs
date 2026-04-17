using System.Net;
using System.Text;
using HoYoMusic.Desktop.Core.Abstractions;
using HoYoMusic.Desktop.Infrastructure.Services;

namespace HoYoMusic.Desktop.Tests;

public class TagServiceTests
{
    [Fact]
    public async Task GetTagsAsync_ReturnsItems()
    {
        const string json = """
        {
          "success": true,
          "data": [
            { "id": 1, "name": "Boss", "color": "#ff0000" }
          ]
        }
        """;

        var service = new TagService(
            new HttpClient(new StubHttpMessageHandler(_ => Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json"),
            }))) { BaseAddress = new Uri("https://music.hoyodb.com/api/") },
            new FakeTokenStore("token"));

        var tags = await service.GetTagsAsync();

        Assert.Single(tags);
        Assert.Equal("Boss", tags[0].Name);
    }

    [Fact]
    public async Task CreateTagAsync_SendsBearerTokenAndPayload()
    {
        HttpRequestMessage? capturedRequest = null;
        string capturedBody = string.Empty;
        const string json = """
        {
          "success": true,
          "data": { "id": 2, "name": "Battle" }
        }
        """;

        var service = new TagService(
            new HttpClient(new StubHttpMessageHandler(async request =>
            {
                capturedRequest = request;
                capturedBody = request.Content is null ? string.Empty : await request.Content.ReadAsStringAsync();
                return new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent(json, Encoding.UTF8, "application/json"),
                };
            })) { BaseAddress = new Uri("https://music.hoyodb.com/api/") },
            new FakeTokenStore("token"));

        var created = await service.CreateTagAsync(new HoYoMusic.Desktop.Core.Models.TagUpsertRequest
        {
            Name = "Battle",
            GroupId = 1,
            Color = "#123456",
        });

        Assert.Equal("Battle", created.Name);
        var request = Assert.IsType<HttpRequestMessage>(capturedRequest);
        Assert.Equal(HttpMethod.Post, request.Method);
        Assert.Equal("/api/tags", request.RequestUri?.AbsolutePath);
        Assert.Equal("Bearer", request.Headers.Authorization?.Scheme);
        Assert.Equal("token", request.Headers.Authorization?.Parameter);
        Assert.Contains("\"name\":\"Battle\"", capturedBody);
        Assert.Contains("\"group_id\":1", capturedBody);
    }

    [Fact]
    public async Task DeleteTagGroupAsync_UsesDeleteRoute()
    {
        HttpRequestMessage? capturedRequest = null;
        const string json = """
        {
          "success": true,
          "data": null
        }
        """;

        var service = new TagService(
            new HttpClient(new StubHttpMessageHandler(request =>
            {
                capturedRequest = request;
                return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent(json, Encoding.UTF8, "application/json"),
                });
            })) { BaseAddress = new Uri("https://music.hoyodb.com/api/") },
            new FakeTokenStore("token"));

        await service.DeleteTagGroupAsync(9);

        var request = Assert.IsType<HttpRequestMessage>(capturedRequest);
        Assert.Equal(HttpMethod.Delete, request.Method);
        Assert.Equal("/api/tags/groups/9", request.RequestUri?.AbsolutePath);
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
        private readonly Func<HttpRequestMessage, Task<HttpResponseMessage>> _handler;
        public StubHttpMessageHandler(Func<HttpRequestMessage, Task<HttpResponseMessage>> handler) => _handler = handler;
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            => _handler(request);
    }
}

