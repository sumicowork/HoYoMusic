using HoYoMusic.Desktop.Core.Models;

namespace HoYoMusic.Desktop.Core.Abstractions;

public interface ISiteConfigService
{
    Task<FirstVisitModalConfig> GetPublicFirstVisitModalAsync(CancellationToken cancellationToken = default);
    Task<SiteComplianceConfig> GetPublicComplianceConfigAsync(CancellationToken cancellationToken = default);
    Task<MaintenanceModeConfig> GetPublicMaintenanceModeAsync(CancellationToken cancellationToken = default);

    Task<FirstVisitModalConfig> GetAdminFirstVisitModalAsync(CancellationToken cancellationToken = default);
    Task<FirstVisitModalConfig> UpdateAdminFirstVisitModalAsync(FirstVisitModalConfig config, CancellationToken cancellationToken = default);

    Task<SiteComplianceConfig> GetAdminComplianceConfigAsync(CancellationToken cancellationToken = default);
    Task<SiteComplianceConfig> UpdateAdminComplianceConfigAsync(SiteComplianceConfig config, CancellationToken cancellationToken = default);

    Task<MaintenanceModeConfig> GetAdminMaintenanceModeAsync(CancellationToken cancellationToken = default);
    Task<MaintenanceModeConfig> UpdateAdminMaintenanceModeAsync(MaintenanceModeConfig config, CancellationToken cancellationToken = default);

    Task<string> SendAdminTestEmailAsync(string email, CancellationToken cancellationToken = default);
}

