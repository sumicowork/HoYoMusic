namespace HoYoMusic.Desktop.Core.Models;

public enum DownloadStatus
{
    Queued,
    Downloading,
    Completed,
    Failed,
    Canceled,
}

public sealed class DownloadTaskItem
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public int TrackId { get; init; }
    public string Title { get; init; } = string.Empty;
    public DownloadStatus Status { get; set; } = DownloadStatus.Queued;
    public double Progress { get; set; }
    public string? ErrorMessage { get; set; }
    public string? FilePath { get; set; }
    public long? BytesReceived { get; set; }
    public long? BytesTotal { get; set; }
    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.Now;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.Now;

    public string ProgressDisplay
    {
        get
        {
            if (BytesTotal.HasValue && BytesTotal.Value > 0 && BytesReceived.HasValue)
            {
                var percent = Math.Clamp(Progress * 100, 0, 100);
                return $"{FormatSize(BytesReceived.Value)} / {FormatSize(BytesTotal.Value)} ({percent:0}%)";
            }

            return BytesReceived.HasValue && BytesReceived.Value > 0
                ? FormatSize(BytesReceived.Value)
                : "等待中";
        }
    }

    private static string FormatSize(long bytes)
    {
        const double kb = 1024;
        const double mb = kb * 1024;
        const double gb = mb * 1024;

        if (bytes >= gb)
        {
            return $"{bytes / gb:0.00} GB";
        }

        if (bytes >= mb)
        {
            return $"{bytes / mb:0.00} MB";
        }

        if (bytes >= kb)
        {
            return $"{bytes / kb:0.00} KB";
        }

        return $"{bytes} B";
    }
}

