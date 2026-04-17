using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using HoYoMusic.Desktop.Core.Abstractions;
using HoYoMusic.Desktop.Core.Contracts;
using HoYoMusic.Desktop.Core.Models;

namespace HoYoMusic.Desktop.Infrastructure.Services;

public sealed class LyricsImportService : ILyricsImportService
{
    private readonly HttpClient _httpClient;
    private readonly ITokenStore _tokenStore;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public LyricsImportService(HttpClient httpClient, ITokenStore tokenStore)
    {
        _httpClient = httpClient;
        _tokenStore = tokenStore;
    }

    public async Task<LyricsImportPreviewResult> PreviewImportAsync(IReadOnlyList<string> filePaths, CancellationToken cancellationToken = default)
    {
        using var request = await CreateAuthenticatedRequestAsync(HttpMethod.Post, "lyrics/import/preview", cancellationToken);
        request.Content = BuildMultipartContent(filePaths, null);

        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var envelope = await ReadEnvelopeAsync<LyricsImportPreviewResult>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
        {
            throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? "Failed to preview lyrics import.", envelope?.Error?.Code, cancellationToken);
        }

        return envelope.Data;
    }

    public async Task<LyricsImportCommitResult> CommitImportAsync(IReadOnlyList<string> filePaths, IReadOnlyDictionary<string, int> resolutions, CancellationToken cancellationToken = default)
    {
        using var request = await CreateAuthenticatedRequestAsync(HttpMethod.Post, "lyrics/import/commit", cancellationToken);
        request.Content = BuildMultipartContent(filePaths, resolutions);

        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var envelope = await ReadEnvelopeAsync<LyricsImportCommitResult>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
        {
            throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? "Failed to commit lyrics import.", envelope?.Error?.Code, cancellationToken);
        }

        return envelope.Data;
    }

    private static MultipartFormDataContent BuildMultipartContent(IReadOnlyList<string> filePaths, IReadOnlyDictionary<string, int>? resolutions)
    {
        if (filePaths.Count == 0)
        {
            throw new ApiException("No files selected for import.", "EMPTY_FILES");
        }

        var content = new MultipartFormDataContent();
        foreach (var filePath in filePaths)
        {
            if (!File.Exists(filePath))
            {
                throw new ApiException($"File not found: {filePath}", "FILE_NOT_FOUND");
            }

            var stream = File.OpenRead(filePath);
            var streamContent = new StreamContent(stream);
            streamContent.Headers.ContentType = new MediaTypeHeaderValue("text/plain");
            content.Add(streamContent, "files", Path.GetFileName(filePath));
        }

        if (resolutions is not null)
        {
            var json = JsonSerializer.Serialize(resolutions, JsonOptions);
            content.Add(new StringContent(json, Encoding.UTF8, "application/json"), "resolutions");
        }

        return content;
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

