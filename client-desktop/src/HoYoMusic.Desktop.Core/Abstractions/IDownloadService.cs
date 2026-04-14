using HoYoMusic.Desktop.Core.Models;

namespace HoYoMusic.Desktop.Core.Abstractions;

public interface IDownloadService
{
    IReadOnlyList<DownloadTaskItem> GetTasks();
    DownloadTaskItem Enqueue(int trackId, string title);
    bool Cancel(Guid taskId);
    bool Retry(Guid taskId);
    int ClearCompleted();
    bool OpenFile(Guid taskId);
    bool OpenFolder(Guid taskId);
}

