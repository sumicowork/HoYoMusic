using System.Net;
using System.Text;
using HoYoMusic.Desktop.Core.Abstractions;
using HoYoMusic.Desktop.Infrastructure.Services;

namespace HoYoMusic.Desktop.Tests;

public class LyricsImportServiceTests
{
    [Fact]
    public async Task PreviewImportAsync_WhenFileMissing_ThrowsApiException()
    {
        var service = new LyricsImportService(new HttpClient(), new FakeTokenStore("token"));

        var ex = await Assert.ThrowsAsync<HoYoMusic.Desktop.Core.Contracts.ApiException>(() =>
            service.PreviewImportAsync(["C:/not_exists/test.lrc"]));

        Assert.Equal("FILE_NOT_FOUND", ex.Code);
    }

    [Fact]
    public async Task CommitImportAsync_ReturnsSummary()
    {
        const string json = """
        {
          "success": true,
          "data": {
            "summary": { "total": 1, "imported": 1, "ambiguous": 0, "not_found": 0, "invalid": 0, "error": 0 },
            "items": []
          }
        }
        """;

        var tempFile = Path.GetTempFileName();
        await File.WriteAllTextAsync(tempFile, "[00:01.00]line");

        try
        {
            var service = new LyricsImportService(
                new HttpClient(new StubHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent(json, Encoding.UTF8, "application/json"),
                })) { BaseAddress = new Uri("https://music.hoyodb.com/api/") },
                new FakeTokenStore("token"));

            var result = await service.CommitImportAsync([tempFile], new Dictionary<string, int>());

            Assert.Equal(1, result.Summary?.Imported);
        }
        finally
        {
            File.Delete(tempFile);
        }
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

