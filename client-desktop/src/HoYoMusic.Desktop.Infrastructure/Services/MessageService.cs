using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using HoYoMusic.Desktop.Core.Abstractions;
using HoYoMusic.Desktop.Core.Contracts;
using HoYoMusic.Desktop.Core.Models;

namespace HoYoMusic.Desktop.Infrastructure.Services;

public sealed class MessageService : IMessageService
{
    private readonly HttpClient _httpClient;
    private readonly ITokenStore _tokenStore;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public MessageService(HttpClient httpClient, ITokenStore tokenStore)
    {
        _httpClient = httpClient;
        _tokenStore = tokenStore;
    }

    public async Task<InboxMessagesResponseData> GetInboxMessagesAsync(int page = 1, int pageSize = 20, CancellationToken cancellationToken = default)
    {
        var query = new QueryStringBuilder()
            .Add("page", Math.Max(1, page))
            .Add("pageSize", Math.Clamp(pageSize, 1, 100))
            .ToString();

        using var request = await CreateAuthenticatedRequestAsync(HttpMethod.Get, $"messages/inbox{query}", cancellationToken);
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var envelope = await ReadEnvelopeAsync<InboxMessagesResponseData>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
        {
            throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? "Failed to load inbox.", envelope?.Error?.Code, cancellationToken);
        }

        return envelope.Data;
    }

    public async Task<int> GetUnreadCountAsync(CancellationToken cancellationToken = default)
    {
        using var request = await CreateAuthenticatedRequestAsync(HttpMethod.Get, "messages/unread-count", cancellationToken);
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var envelope = await ReadEnvelopeAsync<UnreadCountResponseData>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
        {
            throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? "Failed to load unread count.", envelope?.Error?.Code, cancellationToken);
        }

        return envelope.Data.Unread;
    }

    public async Task MarkMessageReadAsync(int deliveryId, CancellationToken cancellationToken = default)
    {
        using var request = await CreateAuthenticatedRequestAsync(HttpMethod.Post, $"messages/{deliveryId}/read", cancellationToken);
        await SendWithoutDataAsync(request, "Failed to mark message as read.", cancellationToken);
    }

    public async Task MarkAllMessagesReadAsync(CancellationToken cancellationToken = default)
    {
        using var request = await CreateAuthenticatedRequestAsync(HttpMethod.Post, "messages/read-all", cancellationToken);
        await SendWithoutDataAsync(request, "Failed to mark all messages as read.", cancellationToken);
    }

    public async Task<int> SendAdminMessageAsync(string title, string content, bool isBroadcast, IReadOnlyList<int>? recipientUserIds = null, DateTimeOffset? expiresAt = null, CancellationToken cancellationToken = default)
    {
        using var request = await CreateAuthenticatedRequestAsync(HttpMethod.Post, "messages/admin/send", cancellationToken);
        request.Content = JsonContent.Create(new
        {
            title,
            content,
            is_broadcast = isBroadcast,
            recipient_user_ids = recipientUserIds,
            expires_at = expiresAt?.ToString("O"),
        }, options: JsonOptions);

        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var envelope = await ReadEnvelopeAsync<SendAdminMessageResponseData>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
        {
            throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? "Failed to send admin message.", envelope?.Error?.Code, cancellationToken);
        }

        return envelope.Data.DeliveryCount;
    }

    private async Task SendWithoutDataAsync(HttpRequestMessage request, string fallbackError, CancellationToken cancellationToken)
    {
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var envelope = await ReadEnvelopeAsync<object>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true)
        {
            throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? fallbackError, envelope?.Error?.Code, cancellationToken);
        }
    }

    private async Task<HttpRequestMessage> CreateAuthenticatedRequestAsync(HttpMethod method, string uri, CancellationToken cancellationToken)
    {
        var token = await _tokenStore.GetTokenAsync(cancellationToken);
        if (string.IsNullOrWhiteSpace(token))
        {
            throw new ApiException("Not authenticated.", "MISSING_TOKEN");
        }

        var request = new HttpRequestMessage(method, uri);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return request;
    }

    private async Task<ApiException> CreateApiExceptionAsync(HttpStatusCode statusCode, string message, string? code, CancellationToken cancellationToken)
    {
        if (statusCode == HttpStatusCode.Unauthorized)
        {
            await _tokenStore.ClearTokenAsync(cancellationToken);
            return new ApiException("Session expired. Please login again.", "UNAUTHORIZED");
        }

        return new ApiException(message, code);
    }

    private static async Task<ApiEnvelope<TData>?> ReadEnvelopeAsync<TData>(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        try
        {
            return await response.Content.ReadFromJsonAsync<ApiEnvelope<TData>>(JsonOptions, cancellationToken);
        }
        catch (JsonException)
        {
            return null;
        }
    }
}

