using HoYoMusic.Desktop.Core.Models;

namespace HoYoMusic.Desktop.Core.Abstractions;

public interface IArtistService
{
    Task<ArtistListResult> GetArtistsAsync(int page = 1, int limit = 50, string? search = null, bool includeAliases = true, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ArtistAliasItem>> GetAliasesAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ArtistRoleAliasItem>> GetRoleAliasesAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyDictionary<string, string>> GetAvatarsAsync(CancellationToken cancellationToken = default);
    Task UpdateArtistAsync(string sourceName, ArtistUpdateRequest request, CancellationToken cancellationToken = default);
    Task<string> UploadAvatarAsync(string artistName, string localFilePath, CancellationToken cancellationToken = default);
    Task MergeArtistsAsync(string canonicalName, IReadOnlyList<string> aliasNames, CancellationToken cancellationToken = default);
    Task MergeRolesAsync(string canonicalRole, IReadOnlyList<string> aliasRoles, CancellationToken cancellationToken = default);
    Task DeleteAliasAsync(int aliasId, CancellationToken cancellationToken = default);
    Task DeleteRoleAliasAsync(int aliasId, CancellationToken cancellationToken = default);
}

