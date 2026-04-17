using System.Net.Http.Json;
using System.Net.Http.Headers;
using System.Text.Json;
using HoYoMusic.Desktop.Core.Abstractions;
using HoYoMusic.Desktop.Core.Contracts;
using HoYoMusic.Desktop.Core.Models;

namespace HoYoMusic.Desktop.Infrastructure.Services;

public sealed class SiteConfigService : ISiteConfigService
{
    private readonly HttpClient _httpClient;
    private readonly ITokenStore _tokenStore;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public SiteConfigService(HttpClient httpClient, ITokenStore tokenStore)
    {
        _httpClient = httpClient;
        _tokenStore = tokenStore;
    }

    public Task<FirstVisitModalConfig> GetPublicFirstVisitModalAsync(CancellationToken cancellationToken = default)
    {
        return GetPublicConfigAsync<FirstVisitModalConfig>("public/site-config/first-visit-modal", "Failed to fetch first-visit config.", cancellationToken);
    }

    public Task<SiteComplianceConfig> GetPublicComplianceConfigAsync(CancellationToken cancellationToken = default)
    {
        return GetPublicConfigAsync<SiteComplianceConfig>("public/site-config/compliance", "Failed to fetch compliance config.", cancellationToken);
    }

    public Task<MaintenanceModeConfig> GetPublicMaintenanceModeAsync(CancellationToken cancellationToken = default)
    {
        return GetPublicConfigAsync<MaintenanceModeConfig>("public/site-config/maintenance", "Failed to fetch maintenance config.", cancellationToken);
    }

    public Task<FirstVisitModalConfig> GetAdminFirstVisitModalAsync(CancellationToken cancellationToken = default)
    {
        return GetAdminConfigAsync<FirstVisitModalConfig>("settings/first-visit-modal", "Failed to fetch first-visit config.", cancellationToken);
    }

    public Task<FirstVisitModalConfig> UpdateAdminFirstVisitModalAsync(FirstVisitModalConfig config, CancellationToken cancellationToken = default)
    {
        return PutAdminConfigAsync<FirstVisitModalConfig>("settings/first-visit-modal", new
        {
            enabled = config.Enabled,
            title = config.Title,
            content = config.Content,
            min_stay_seconds = config.MinStaySeconds,
        }, "Failed to update first-visit config.", cancellationToken);
    }

    public Task<SiteComplianceConfig> GetAdminComplianceConfigAsync(CancellationToken cancellationToken = default)
    {
        return GetAdminConfigAsync<SiteComplianceConfig>("settings/compliance", "Failed to fetch compliance config.", cancellationToken);
    }

    public Task<SiteComplianceConfig> UpdateAdminComplianceConfigAsync(SiteComplianceConfig config, CancellationToken cancellationToken = default)
    {
        return PutAdminConfigAsync<SiteComplianceConfig>("settings/compliance", new
        {
            enabled = config.Enabled,
            icp_number = config.IcpNumber,
            public_security_number = config.PublicSecurityNumber,
        }, "Failed to update compliance config.", cancellationToken);
    }

    public Task<MaintenanceModeConfig> GetAdminMaintenanceModeAsync(CancellationToken cancellationToken = default)
    {
        return GetAdminConfigAsync<MaintenanceModeConfig>("settings/maintenance", "Failed to fetch maintenance config.", cancellationToken);
    }

    public Task<MaintenanceModeConfig> UpdateAdminMaintenanceModeAsync(MaintenanceModeConfig config, CancellationToken cancellationToken = default)
    {
        return PutAdminConfigAsync<MaintenanceModeConfig>("settings/maintenance", new
        {
            enabled = config.Enabled,
            expected_end_time = string.IsNullOrWhiteSpace(config.ExpectedEndTime) ? null : config.ExpectedEndTime,
            message = config.Message,
        }, "Failed to update maintenance config.", cancellationToken);
    }

    public async Task<string> SendAdminTestEmailAsync(string email, CancellationToken cancellationToken = default)
    {
        using var request = await CreateAdminRequestAsync(HttpMethod.Post, "settings/test-email", cancellationToken);
        request.Content = JsonContent.Create(new { email }, options: JsonOptions);

        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var envelope = await response.Content.ReadFromJsonAsync<ApiEnvelope<TestEmailResponseData>>(JsonOptions, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
        {
            throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? "Failed to send test email.", envelope?.Error?.Code, cancellationToken);
        }

        return envelope.Data.Message;
    }

    private async Task<TConfig> GetPublicConfigAsync<TConfig>(string endpoint, string fallbackMessage, CancellationToken cancellationToken)
    {
        using var response = await _httpClient.GetAsync(endpoint, cancellationToken);
        var envelope = await response.Content.ReadFromJsonAsync<ApiEnvelope<TConfig>>(JsonOptions, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
        {
            throw new ApiException(envelope?.Error?.Message ?? fallbackMessage, envelope?.Error?.Code);
        }

        return envelope.Data;
    }

    private async Task<TConfig> GetAdminConfigAsync<TConfig>(string endpoint, string fallbackMessage, CancellationToken cancellationToken)
    {
        using var request = await CreateAdminRequestAsync(HttpMethod.Get, endpoint, cancellationToken);
        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var envelope = await response.Content.ReadFromJsonAsync<ApiEnvelope<TConfig>>(JsonOptions, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
        {
            throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? fallbackMessage, envelope?.Error?.Code, cancellationToken);
        }

        return envelope.Data;
    }

    private async Task<TConfig> PutAdminConfigAsync<TConfig>(string endpoint, object payload, string fallbackMessage, CancellationToken cancellationToken)
    {
        using var request = await CreateAdminRequestAsync(HttpMethod.Put, endpoint, cancellationToken);
        request.Content = JsonContent.Create(payload, options: JsonOptions);

        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var envelope = await response.Content.ReadFromJsonAsync<ApiEnvelope<TConfig>>(JsonOptions, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope?.Success != true || envelope.Data is null)
        {
            throw await CreateApiExceptionAsync(response.StatusCode, envelope?.Error?.Message ?? fallbackMessage, envelope?.Error?.Code, cancellationToken);
        }

        return envelope.Data;
    }

    private async Task<HttpRequestMessage> CreateAdminRequestAsync(HttpMethod method, string endpoint, CancellationToken cancellationToken)
    {
        var token = await _tokenStore.GetTokenAsync(cancellationToken);
        if (string.IsNullOrWhiteSpace(token))
        {
            throw new ApiException("Not authenticated.", "MISSING_TOKEN");
        }

        var request = new HttpRequestMessage(method, endpoint);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return request;
    }

    private async Task<ApiException> CreateApiExceptionAsync(System.Net.HttpStatusCode statusCode, string message, string? code, CancellationToken cancellationToken)
    {
        if (statusCode == System.Net.HttpStatusCode.Unauthorized)
        {
            await _tokenStore.ClearTokenAsync(cancellationToken);
            return new ApiException("Session expired. Please login again.", "UNAUTHORIZED");
        }

        return new ApiException(message, code);
    }

    private sealed class TestEmailResponseData
    {
        public string Message { get; init; } = string.Empty;
    }
}

