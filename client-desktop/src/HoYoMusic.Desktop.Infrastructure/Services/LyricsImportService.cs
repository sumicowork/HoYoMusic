using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using HoYoMusic.Desktop.Core.Abstractions;
using HoYoMusic.Desktop.Core.Contracts;
using HoYoMusic.Desktop.Core.Models;

namespace HoYoMusic.Desktop.Infrastructure.Services;

public sealed class LyricsImportService : HoYoApiClient, ILyricsImportService
{
    public LyricsImportService(HttpClient httpClient, ITokenStore tokenStore) : base(httpClient, tokenStore) { }

    public async Task<LyricsImportPreviewResult> PreviewImportAsync(IReadOnlyList<string> filePaths, CancellationToken ct = default)
        => await PostMultipartAsync<LyricsImportPreviewResult>("lyrics/import/preview", filePaths, null, "Failed to preview lyrics import.", ct);

    public async Task<LyricsImportCommitResult> CommitImportAsync(IReadOnlyList<string> filePaths, IReadOnlyDictionary<string, int> resolutions, CancellationToken ct = default)
        => await PostMultipartAsync<LyricsImportCommitResult>("lyrics/import/commit", filePaths, resolutions, "Failed to commit lyrics import.", ct);

    private async Task<TData> PostMultipartAsync<TData>(string uri, IReadOnlyList<string> filePaths, IReadOnlyDictionary<string, int>? resolutions, string fallbackError, CancellationToken ct) where TData : class
    {
        using var request = await CreateAuthedRequestAsync(HttpMethod.Post, uri, ct);
        request.Content = BuildMultipartContent(filePaths, resolutions);
        using var response = await Http.SendAsync(request, ct);
        var envelope = await ReadEnvelopeAsync<TData>(response, ct);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
            throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? fallbackError, envelope?.Error?.Code, ct);
        return envelope.Data;
    }

    private static MultipartFormDataContent BuildMultipartContent(IReadOnlyList<string> filePaths, IReadOnlyDictionary<string, int>? resolutions)
    {
        if (filePaths.Count == 0)
            throw new ApiException("No files selected for import.", "EMPTY_FILES");

        var content = new MultipartFormDataContent();
        foreach (var filePath in filePaths)
        {
            if (!File.Exists(filePath))
                throw new ApiException($"File not found: {filePath}", "FILE_NOT_FOUND");

            var stream = File.OpenRead(filePath);
            var streamContent = new StreamContent(stream) { Headers = { ContentType = new MediaTypeHeaderValue("text/plain") } };
            content.Add(streamContent, "files", Path.GetFileName(filePath));
        }

        if (resolutions is not null)
        {
            var json = JsonSerializer.Serialize(resolutions, JsonOptions);
            content.Add(new StringContent(json, Encoding.UTF8, "application/json"), "resolutions");
        }

        return content;
    }
}
