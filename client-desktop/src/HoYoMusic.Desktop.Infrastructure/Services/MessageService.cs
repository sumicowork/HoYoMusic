using System.Net.Http.Json;
using HoYoMusic.Desktop.Core.Abstractions;
using HoYoMusic.Desktop.Core.Contracts;
using HoYoMusic.Desktop.Core.Models;

namespace HoYoMusic.Desktop.Infrastructure.Services;

public sealed class MessageService : HoYoApiClient, IMessageService
{
    public MessageService(HttpClient httpClient, ITokenStore tokenStore) : base(httpClient, tokenStore) { }

    public async Task<InboxMessagesResponseData> GetInboxMessagesAsync(int page = 1, int pageSize = 20, CancellationToken ct = default)
    {
        var query = new QueryStringBuilder()
            .Add("page", Math.Max(1, page))
            .Add("pageSize", Math.Clamp(pageSize, 1, 100))
            .ToString();
        return await GetAuthedAsync<InboxMessagesResponseData>(HttpMethod.Get, $"messages/inbox{query}", "Failed to load inbox.", ct);
    }

    public async Task<int> GetUnreadCountAsync(CancellationToken ct = default)
    {
        var result = await GetAuthedAsync<UnreadCountResponseData>(HttpMethod.Get, "messages/unread-count", "Failed to load unread count.", ct);
        return result.Unread;
    }

    public async Task MarkMessageReadAsync(int deliveryId, CancellationToken ct = default)
        => await PostVoidAsync($"messages/{deliveryId}/read", "Failed to mark message as read.", ct);

    public async Task MarkAllMessagesReadAsync(CancellationToken ct = default)
        => await PostVoidAsync("messages/read-all", "Failed to mark all messages as read.", ct);

    public async Task<int> SendAdminMessageAsync(string title, string content, bool isBroadcast, IReadOnlyList<int>? recipientUserIds = null, DateTimeOffset? expiresAt = null, CancellationToken ct = default)
    {
        var result = await PostFormAsync<SendAdminMessageResponseData>("messages/admin/send", new
        {
            title, content,
            is_broadcast = isBroadcast,
            recipient_user_ids = recipientUserIds,
            expires_at = expiresAt?.ToString("O"),
        }, "Failed to send admin message.", ct);
        return result.DeliveryCount;
    }

    private async Task<TData> GetAuthedAsync<TData>(HttpMethod method, string uri, string fallbackError, CancellationToken ct) where TData : class
    {
        using var request = await CreateAuthedRequestAsync(method, uri, ct);
        using var response = await Http.SendAsync(request, ct);
        var envelope = await ReadEnvelopeAsync<TData>(response, ct);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
            throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? fallbackError, envelope?.Error?.Code, ct);
        return envelope.Data;
    }

    private async Task PostVoidAsync(string uri, string fallbackError, CancellationToken ct)
    {
        using var authRequest = await CreateAuthedRequestAsync(HttpMethod.Post, uri, ct);
        await SendWithoutDataAsync(authRequest, fallbackError, ct);
    }

    private async Task<TData> PostFormAsync<TData>(string uri, object payload, string fallbackError, CancellationToken ct) where TData : class
    {
        using var authRequest = await CreateAuthedRequestAsync(HttpMethod.Post, uri, ct);
        authRequest.Content = JsonContent.Create(payload, options: JsonOptions);
        using var response = await Http.SendAsync(authRequest, ct);
        var envelope = await ReadEnvelopeAsync<TData>(response, ct);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
            throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? fallbackError, envelope?.Error?.Code, ct);
        return envelope.Data;
    }

}
