using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using HoYoMusic.Desktop.Core.Abstractions;
using HoYoMusic.Desktop.Core.Contracts;

namespace HoYoMusic.Desktop.Infrastructure.Services;

public abstract class HoYoApiClient
{
    protected static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    protected HttpClient Http { get; }
    protected ITokenStore TokenStore { get; }

    protected HoYoApiClient(HttpClient httpClient, ITokenStore tokenStore)
    {
        Http = httpClient;
        TokenStore = tokenStore;
    }

    protected async Task<HttpRequestMessage> CreateAuthedRequestAsync(HttpMethod method, string uri, CancellationToken ct)
    {
        var token = await TokenStore.GetTokenAsync(ct);
        if (string.IsNullOrWhiteSpace(token))
        {
            throw new ApiException("Not authenticated.", "MISSING_TOKEN");
        }

        var request = new HttpRequestMessage(method, uri);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return request;
    }

    protected async Task<HttpRequestMessage> CreateAuthedRequestAsync<TPayload>(HttpMethod method, string uri, CancellationToken ct, TPayload payload)
    {
        var request = await CreateAuthedRequestAsync(method, uri, ct);
        request.Content = JsonContent.Create(payload, options: JsonOptions);
        return request;
    }

    protected static async Task<ApiEnvelope<TData>?> ReadEnvelopeAsync<TData>(HttpResponseMessage response, CancellationToken ct)
    {
        try
        {
            return await response.Content.ReadFromJsonAsync<ApiEnvelope<TData>>(JsonOptions, ct);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    protected async Task EnsureSuccessAsync(HttpResponseMessage response, string fallbackMessage, CancellationToken ct)
    {
        if (response.IsSuccessStatusCode) return;

        var envelope = await ReadEnvelopeAsync<object>(response, ct);
        throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? fallbackMessage, envelope?.Error?.Code, ct);
    }

    protected async Task SendWithoutDataAsync(HttpRequestMessage request, string fallbackError, CancellationToken ct)
    {
        using var response = await Http.SendAsync(request, ct);
        await EnsureSuccessAsync(response, fallbackError, ct);
    }

    protected async Task<ApiException> CreateApiExceptionAsync(HttpStatusCode statusCode, string message, string? code, CancellationToken ct)
    {
        if (statusCode == HttpStatusCode.Unauthorized)
        {
            await TokenStore.ClearTokenAsync(ct);
            return new ApiException("Session expired. Please login again.", "UNAUTHORIZED");
        }

        return new ApiException(message, code);
    }

    protected static string ResolveMediaType(string filePath)
    {
        return Path.GetExtension(filePath).ToLowerInvariant() switch
        {
            ".png" => "image/png",
            ".jpg" or ".jpeg" => "image/jpeg",
            ".webp" => "image/webp",
            ".gif" => "image/gif",
            _ => "application/octet-stream",
        };
    }
}
