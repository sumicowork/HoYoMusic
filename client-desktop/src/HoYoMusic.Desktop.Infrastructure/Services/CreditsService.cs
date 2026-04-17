using System.Net.Http.Json;
using System.Net.Http.Headers;
using System.Text.Json;
using HoYoMusic.Desktop.Core.Abstractions;
using HoYoMusic.Desktop.Core.Contracts;
using HoYoMusic.Desktop.Core.Models;

namespace HoYoMusic.Desktop.Infrastructure.Services;

public sealed class CreditsService : ICreditsService
{
    private readonly HttpClient _httpClient;
    private readonly ITokenStore _tokenStore;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public CreditsService(HttpClient httpClient, ITokenStore tokenStore)
    {
        _httpClient = httpClient;
        _tokenStore = tokenStore;
    }

    public async Task<IReadOnlyList<CreditItem>> GetCreditsAsync(int trackId, CancellationToken cancellationToken = default)
    {
        using var response = await _httpClient.GetAsync($"credits/{trackId}/credits", cancellationToken);
        var envelope = await ReadEnvelopeAsync<CreditsResponseData>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
        {
            throw new ApiException(envelope?.Error?.Message ?? "Failed to load credits.", envelope?.Error?.Code);
        }

        return envelope.Data.Credits;
    }

    public async Task<BinaryFileResult> ExportCreditsAsync(IReadOnlyCollection<int> albumIds, CancellationToken cancellationToken = default)
    {
        var token = await _tokenStore.GetTokenAsync(cancellationToken);
        if (string.IsNullOrWhiteSpace(token))
        {
            throw new ApiException("Not authenticated.", "MISSING_TOKEN");
        }

        using var request = new HttpRequestMessage(HttpMethod.Post, "credits/export")
        {
            Content = JsonContent.Create(new { albumIds }),
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var response = await _httpClient.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var envelope = await ReadEnvelopeAsync<object>(response, cancellationToken);
            throw new ApiException(envelope?.Error?.Message ?? "Failed to export credits.", envelope?.Error?.Code);
        }

        var content = await response.Content.ReadAsByteArrayAsync(cancellationToken);
        var fileName = ParseFileName(response.Content.Headers.ContentDisposition?.ToString());
        var contentType = response.Content.Headers.ContentType?.MediaType ?? "application/octet-stream";
        return new BinaryFileResult
        {
            Content = content,
            FileName = fileName,
            ContentType = contentType,
        };
    }

    private static string ParseFileName(string? contentDisposition)
    {
        const string fallback = "credits-export.json";
        if (string.IsNullOrWhiteSpace(contentDisposition))
        {
            return fallback;
        }

        var utf8Match = System.Text.RegularExpressions.Regex.Match(contentDisposition, "filename\\*=UTF-8''([^;]+)", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        if (utf8Match.Success)
        {
            return Uri.UnescapeDataString(utf8Match.Groups[1].Value).Trim('"');
        }

        var plainMatch = System.Text.RegularExpressions.Regex.Match(contentDisposition, "filename=\"?([^\";]+)\"?", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        return plainMatch.Success ? plainMatch.Groups[1].Value.Trim() : fallback;
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

