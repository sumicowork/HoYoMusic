using HoYoMusic.Desktop.Core.Models;
using HoYoMusic.Desktop.Infrastructure.Services;
using System.Net;
using System.Net.Http;

namespace HoYoMusic.Desktop.Tests;

public class DownloadQueueServiceTests
{
    [Fact]
    public void Enqueue_AddsQueuedTask()
    {
        var service = CreateService();

        var task = service.Enqueue(7, "Test Track");

        Assert.True(task.Status is DownloadStatus.Queued or DownloadStatus.Downloading);
        Assert.Single(service.GetTasks());
    }

    [Fact]
    public void Cancel_QueuedTask_MarksCanceled()
    {
        var service = CreateService();
        var task = service.Enqueue(8, "Track 8");

        var canceled = service.Cancel(task.Id);

        Assert.True(canceled);
        Assert.Equal(DownloadStatus.Canceled, service.GetTasks().Single().Status);
    }

    private static DownloadQueueService CreateService()
    {
        var client = new HttpClient(new FakeOkHandler())
        {
            BaseAddress = new Uri("http://localhost/api/"),
        };
        return new DownloadQueueService(client);
    }

    private sealed class FakeOkHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var response = new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new ByteArrayContent([1, 2, 3, 4]),
            };
            return Task.FromResult(response);
        }
    }
}

