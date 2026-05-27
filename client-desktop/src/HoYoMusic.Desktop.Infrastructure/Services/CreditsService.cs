using System.Net.Http.Json;
using HoYoMusic.Desktop.Core.Abstractions;
using HoYoMusic.Desktop.Core.Contracts;
using HoYoMusic.Desktop.Core.Models;

namespace HoYoMusic.Desktop.Infrastructure.Services;

public sealed class CreditsService : HoYoApiClient, ICreditsService
{
    public CreditsService(HttpClient httpClient, ITokenStore tokenStore) : base(httpClient, tokenStore) { }

    public async Task<IReadOnlyList<CreditItem>> GetCreditsAsync(int trackId, CancellationToken ct = default)
    {
        using var response = await Http.GetAsync($"public/tracks/{trackId}/credits", ct);
        var envelope = await ReadEnvelopeAsync<IReadOnlyList<CreditItem>>(response, ct);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
            throw new ApiException(envelope?.Error?.Message ?? "Failed to load credits.", envelope?.Error?.Code);
        return envelope.Data;
    }

    public async Task<BinaryFileResult> ExportCreditsAsync(IReadOnlyCollection<int> albumIds, CancellationToken ct = default)
    {
        using var request = await CreateAuthedRequestAsync(HttpMethod.Post, "credits/export", ct);
        request.Content = JsonContent.Create(new { album_ids = albumIds }, options: JsonOptions);
        using var response = await Http.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
        {
            var envelope = await ReadEnvelopeAsync<object>(response, ct);
            throw new ApiException(envelope?.Error?.Message ?? "Failed to export credits.", envelope?.Error?.Code);
        }

        var bytes = await response.Content.ReadAsByteArrayAsync(ct);
        return new BinaryFileResult
        {
            Content = bytes,
            FileName = ParseDispositionFileName(response, "credits-export.json"),
            ContentType = response.Content.Headers.ContentType?.MediaType ?? "application/octet-stream",
        };
    }

    private static string ParseDispositionFileName(HttpResponseMessage response, string fallback)
    {
        var cd = response.Content.Headers.ContentDisposition?.ToString();
        if (string.IsNullOrWhiteSpace(cd)) return fallback;
        var m = System.Text.RegularExpressions.Regex.Match(cd, "filename\\*=UTF-8''([^;]+)", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        if (m.Success) return Uri.UnescapeDataString(m.Groups[1].Value).Trim('"');
        m = System.Text.RegularExpressions.Regex.Match(cd, "filename=\"?([^\";]+)\"?", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        return m.Success ? m.Groups[1].Value.Trim() : fallback;
    }
}
