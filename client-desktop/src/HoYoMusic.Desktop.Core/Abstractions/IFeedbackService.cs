using HoYoMusic.Desktop.Core.Models;

namespace HoYoMusic.Desktop.Core.Abstractions;

public interface IFeedbackService
{
    Task SubmitAsync(string content, string? contact = null, CancellationToken cancellationToken = default);
    Task<FeedbackListResult> GetAdminListAsync(int page = 1, int pageSize = 20, CancellationToken cancellationToken = default);
}

