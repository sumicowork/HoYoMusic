using HoYoMusic.Desktop.Core.Abstractions;
using HoYoMusic.Desktop.Core.Models;
using System.Diagnostics;
using System.Net.Http;
using System.Text;

namespace HoYoMusic.Desktop.Infrastructure.Services;

public sealed class DownloadQueueService : IDownloadService
{
    private readonly HttpClient _httpClient;
    private readonly List<DownloadTaskItem> _tasks = [];
    private readonly object _sync = new();
    private readonly SemaphoreSlim _signal = new(0);
    private readonly string _downloadRoot;

    public DownloadQueueService(HttpClient httpClient)
    {
        _httpClient = httpClient;
        _downloadRoot = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyMusic), "HoYoMusic", "Downloads");
        Directory.CreateDirectory(_downloadRoot);
        _ = Task.Run(ProcessQueueLoopAsync);
    }

    public IReadOnlyList<DownloadTaskItem> GetTasks()
    {
        lock (_sync)
        {
            return _tasks.Select(task => task).ToList();
        }
    }

    public DownloadTaskItem Enqueue(int trackId, string title)
    {
        var task = new DownloadTaskItem
        {
            TrackId = trackId,
            Title = string.IsNullOrWhiteSpace(title) ? $"Track-{trackId}" : title,
            Status = DownloadStatus.Queued,
            Progress = 0,
        };

        lock (_sync)
        {
            _tasks.Add(task);
        }

        _signal.Release();

        return task;
    }

    public bool Cancel(Guid taskId)
    {
        lock (_sync)
        {
            var task = _tasks.FirstOrDefault(item => item.Id == taskId);
            if (task is null)
            {
                return false;
            }

            if (task.Status is DownloadStatus.Completed or DownloadStatus.Canceled)
            {
                return false;
            }

            task.Status = DownloadStatus.Canceled;
            task.UpdatedAt = DateTimeOffset.Now;
            return true;
        }
    }

    public bool Retry(Guid taskId)
    {
        lock (_sync)
        {
            var task = _tasks.FirstOrDefault(item => item.Id == taskId);
            if (task is null)
            {
                return false;
            }

            if (task.Status is not (DownloadStatus.Failed or DownloadStatus.Canceled))
            {
                return false;
            }

            task.Status = DownloadStatus.Queued;
            task.Progress = 0;
            task.ErrorMessage = null;
            task.BytesReceived = 0;
            task.BytesTotal = null;
            task.UpdatedAt = DateTimeOffset.Now;
            _signal.Release();
            return true;
        }
    }

    public int ClearCompleted()
    {
        lock (_sync)
        {
            return _tasks.RemoveAll(item => item.Status is DownloadStatus.Completed or DownloadStatus.Canceled);
        }
    }

    public bool OpenFile(Guid taskId)
    {
        var path = ResolveDownloadedPath(taskId);
        if (string.IsNullOrWhiteSpace(path) || !File.Exists(path))
        {
            return false;
        }

        Process.Start(new ProcessStartInfo
        {
            FileName = path,
            UseShellExecute = true,
        });
        return true;
    }

    public bool OpenFolder(Guid taskId)
    {
        var path = ResolveDownloadedPath(taskId);
        if (string.IsNullOrWhiteSpace(path) || !File.Exists(path))
        {
            return false;
        }

        Process.Start(new ProcessStartInfo
        {
            FileName = "explorer.exe",
            Arguments = $"/select,\"{path}\"",
            UseShellExecute = true,
        });
        return true;
    }

    private string? ResolveDownloadedPath(Guid taskId)
    {
        lock (_sync)
        {
            return _tasks.FirstOrDefault(item => item.Id == taskId)?.FilePath;
        }
    }

    private async Task ProcessQueueLoopAsync()
    {
        while (true)
        {
            await _signal.WaitAsync();
            DownloadTaskItem? queued;
            lock (_sync)
            {
                queued = _tasks.FirstOrDefault(item => item.Status == DownloadStatus.Queued);
                if (queued is not null)
                {
                    queued.Status = DownloadStatus.Downloading;
                    queued.UpdatedAt = DateTimeOffset.Now;
                }
            }

            if (queued is null)
            {
                continue;
            }

            await ExecuteDownloadAsync(queued);
        }
    }

    private async Task ExecuteDownloadAsync(DownloadTaskItem task)
    {
        try
        {
            var fileName = BuildFileName(task);
            var targetPath = Path.Combine(_downloadRoot, fileName);
            task.FilePath = targetPath;
            task.BytesReceived = 0;
            task.BytesTotal = null;

            using var response = await _httpClient.GetAsync($"public/tracks/{task.TrackId}/download", HttpCompletionOption.ResponseHeadersRead);
            response.EnsureSuccessStatusCode();

            task.BytesTotal = response.Content.Headers.ContentLength;
            await using var source = await response.Content.ReadAsStreamAsync();
            await using var destination = new FileStream(targetPath, FileMode.Create, FileAccess.Write, FileShare.Read);

            var buffer = new byte[81920];
            while (true)
            {
                if (task.Status == DownloadStatus.Canceled)
                {
                    break;
                }

                var bytesRead = await source.ReadAsync(buffer);
                if (bytesRead <= 0)
                {
                    break;
                }

                await destination.WriteAsync(buffer.AsMemory(0, bytesRead));
                task.BytesReceived = (task.BytesReceived ?? 0) + bytesRead;
                if (task.BytesTotal.HasValue && task.BytesTotal.Value > 0)
                {
                    task.Progress = Math.Clamp(task.BytesReceived.Value / (double)task.BytesTotal.Value, 0, 1);
                }
                task.UpdatedAt = DateTimeOffset.Now;
            }

            if (task.Status == DownloadStatus.Canceled)
            {
                TryDeleteFile(targetPath);
                return;
            }

            task.Progress = 1;
            task.Status = DownloadStatus.Completed;
            task.UpdatedAt = DateTimeOffset.Now;
        }
        catch (Exception ex)
        {
            task.Status = DownloadStatus.Failed;
            task.ErrorMessage = ex.Message;
            task.UpdatedAt = DateTimeOffset.Now;
        }
    }

    private static string BuildFileName(DownloadTaskItem task)
    {
        var raw = string.IsNullOrWhiteSpace(task.Title) ? $"track-{task.TrackId}" : task.Title;
        var sb = new StringBuilder(raw.Length);
        foreach (var ch in raw)
        {
            sb.Append(Path.GetInvalidFileNameChars().Contains(ch) ? '_' : ch);
        }

        return $"{sb}-{task.TrackId}.flac";
    }

    private static void TryDeleteFile(string path)
    {
        try
        {
            if (File.Exists(path))
            {
                File.Delete(path);
            }
        }
        catch
        {
            // Ignore cleanup errors.
        }
    }
}

