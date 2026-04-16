using HoYoMusic.Desktop.Core.Models;

namespace HoYoMusic.Desktop.Core.Abstractions;

public interface IMessageService
{
    Task<InboxMessagesResponseData> GetInboxMessagesAsync(int page = 1, int pageSize = 20, CancellationToken cancellationToken = default);
    Task<int> GetUnreadCountAsync(CancellationToken cancellationToken = default);
    Task MarkMessageReadAsync(int deliveryId, CancellationToken cancellationToken = default);
    Task MarkAllMessagesReadAsync(CancellationToken cancellationToken = default);
    Task<int> SendAdminMessageAsync(string title, string content, bool isBroadcast, IReadOnlyList<int>? recipientUserIds = null, DateTimeOffset? expiresAt = null, CancellationToken cancellationToken = default);
}

