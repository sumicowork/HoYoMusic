using System.Net;
using System.Net.Http;
using System.Text;
using HoYoMusic.Desktop.Core.Abstractions;
using HoYoMusic.Desktop.Core.Contracts;
using HoYoMusic.Desktop.Core.Models;
using HoYoMusic.Desktop.Infrastructure.Services;

namespace HoYoMusic.Desktop.Tests;

public class SiteConfigServiceTests
{
    [Fact]
    public async Task GetPublicMaintenanceModeAsync_ReturnsPayload()
    {
        var json = """
        {
          "success": true,
          "data": {
            "enabled": true,
            "expected_end_time": "2026-04-14T18:00:00.000Z",
            "message": "维护中",
            "version": "7"
          }
        }
        """;

        var client = CreateClient(json);
        var service = new SiteConfigService(client, new FakeTokenStore("token"));

        var result = await service.GetPublicMaintenanceModeAsync();

        Assert.True(result.Enabled);
        Assert.Equal("维护中", result.Message);
        Assert.Equal("7", result.Version);
    }

    [Fact]
    public async Task GetPublicComplianceConfigAsync_WhenApiFails_ThrowsApiException()
    {
        var json = """
        {
          "success": false,
          "error": {
            "code": "SETTINGS_READ_ERROR",
            "message": "read failed"
          }
        }
        """;

        var client = new HttpClient(new StubHttpMessageHandler(_ =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.InternalServerError)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json"),
            })))
        {
            BaseAddress = new Uri("https://music.hoyodb.com/api/"),
        };

        var service = new SiteConfigService(client, new FakeTokenStore("token"));
        var ex = await Assert.ThrowsAsync<ApiException>(() => service.GetPublicComplianceConfigAsync());

        Assert.Equal("SETTINGS_READ_ERROR", ex.Code);
    }

    [Fact]
    public async Task SendAdminTestEmailAsync_ReturnsMessage()
    {
        const string json = """
        {
          "success": true,
          "data": {
            "message": "sent"
          }
        }
        """;

        var client = CreateClient(json);
        var service = new SiteConfigService(client, new FakeTokenStore("token"));

        var message = await service.SendAdminTestEmailAsync("a@b.com");

        Assert.Equal("sent", message);
    }

    [Fact]
    public async Task UpdateAdminFirstVisitModalAsync_SendsAuthorizedPut()
    {
        HttpRequestMessage? capturedRequest = null;
        string capturedBody = string.Empty;
        const string json = """
        {
          "success": true,
          "data": {
            "enabled": true,
            "title": "notice",
            "content": "read me",
            "min_stay_seconds": 5,
            "version": "v2"
          }
        }
        """;

        var client = new HttpClient(new StubHttpMessageHandler(async request =>
        {
            capturedRequest = request;
            capturedBody = request.Content is null ? string.Empty : await request.Content.ReadAsStringAsync();
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json"),
            };
        }))
        {
            BaseAddress = new Uri("https://music.hoyodb.com/api/"),
        };

        var service = new SiteConfigService(client, new FakeTokenStore("token"));
        var result = await service.UpdateAdminFirstVisitModalAsync(new FirstVisitModalConfig
        {
            Enabled = true,
            Title = "notice",
            Content = "read me",
            MinStaySeconds = 5,
            Version = "v2",
        });

        Assert.Equal("notice", result.Title);
        var request = Assert.IsType<HttpRequestMessage>(capturedRequest);
        Assert.Equal(HttpMethod.Put, request.Method);
        Assert.Equal("/api/settings/first-visit-modal", request.RequestUri?.AbsolutePath);
        Assert.Equal("Bearer", request.Headers.Authorization?.Scheme);
        Assert.Contains("\"min_stay_seconds\":5", capturedBody);
    }

    [Fact]
    public async Task UpdateAdminComplianceConfigAsync_SendsCompliancePayload()
    {
        HttpRequestMessage? capturedRequest = null;
        string capturedBody = string.Empty;
        const string json = """
        {
          "success": true,
          "data": {
            "enabled": true,
            "icp_number": "ICP-123",
            "public_security_number": "PS-987"
          }
        }
        """;

        var client = new HttpClient(new StubHttpMessageHandler(async request =>
        {
            capturedRequest = request;
            capturedBody = request.Content is null ? string.Empty : await request.Content.ReadAsStringAsync();
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json"),
            };
        }))
        {
            BaseAddress = new Uri("https://music.hoyodb.com/api/"),
        };

        var service = new SiteConfigService(client, new FakeTokenStore("token"));
        await service.UpdateAdminComplianceConfigAsync(new SiteComplianceConfig
        {
            Enabled = true,
            IcpNumber = "ICP-123",
            PublicSecurityNumber = "PS-987",
        });

        var request = Assert.IsType<HttpRequestMessage>(capturedRequest);
        Assert.Equal(HttpMethod.Put, request.Method);
        Assert.Equal("/api/settings/compliance", request.RequestUri?.AbsolutePath);
        Assert.Contains("\"icp_number\":\"ICP-123\"", capturedBody);
        Assert.Contains("\"public_security_number\":\"PS-987\"", capturedBody);
    }

    private static HttpClient CreateClient(string json)
    {
        return new HttpClient(new StubHttpMessageHandler(_ =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json"),
            })))
        {
            BaseAddress = new Uri("https://music.hoyodb.com/api/"),
        };
    }

    private sealed class StubHttpMessageHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, Task<HttpResponseMessage>> _handler;

        public StubHttpMessageHandler(Func<HttpRequestMessage, Task<HttpResponseMessage>> handler)
        {
            _handler = handler;
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            return _handler(request);
        }
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
}

