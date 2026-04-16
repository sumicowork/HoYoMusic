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
            new HttpClient(new StubHttpMessageHandler(_ => Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json"),
            }))) { BaseAddress = new Uri("https://music.hoyodb.com/api/") },
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

    [Fact]
    public async Task SendAdminMessageAsync_ReturnsDeliveryCount()
    {
        const string json = """
        {
          "success": true,
          "data": {
            "delivery_count": 7
          }
        }
        """;

        var service = new MessageService(
            new HttpClient(new StubHttpMessageHandler(_ => Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json"),
            }))) { BaseAddress = new Uri("https://music.hoyodb.com/api/") },
            new FakeTokenStore("token"));

        var deliveryCount = await service.SendAdminMessageAsync("title", "content", true);

        Assert.Equal(7, deliveryCount);
    }

    [Fact]
    public async Task SendAdminMessageAsync_WithTargetUsers_SendsRecipientList()
    {
        HttpRequestMessage? capturedRequest = null;
        string capturedBody = string.Empty;
        const string json = """
        {
          "success": true,
          "data": {
            "delivery_count": 2
          }
        }
        """;

        var service = new MessageService(
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

        await service.SendAdminMessageAsync("notice", "body", false, new[] { 1, 3 }, DateTimeOffset.Parse("2026-04-16T00:00:00+08:00"));

        var request = Assert.IsType<HttpRequestMessage>(capturedRequest);
        Assert.Equal(HttpMethod.Post, request.Method);
        Assert.Equal("/api/messages/admin/send", request.RequestUri?.AbsolutePath);
        Assert.Equal("Bearer", request.Headers.Authorization?.Scheme);
        Assert.Contains("\"is_broadcast\":false", capturedBody);
        Assert.Contains("\"recipient_user_ids\":[1,3]", capturedBody);
        Assert.Contains("\"expires_at\":", capturedBody);
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
        private readonly Func<HttpRequestMessage, Task<HttpResponseMessage>> _handler;

        public StubHttpMessageHandler(Func<HttpRequestMessage, Task<HttpResponseMessage>> handler)
        {
            _handler = handler;
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            => _handler(request);
    }
}

