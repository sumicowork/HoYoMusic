using HoYoMusic.Desktop.Core.Models;

namespace HoYoMusic.Desktop.Core.Abstractions;

public interface ITrackService
{
    Task<IReadOnlyList<TrackItem>> GetTracksAsync(int page = 1, int limit = 50, IReadOnlyCollection<int>? gameIds = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<TrackItem>> GetPublicTracksAsync(int page = 1, int limit = 20, string? search = null, IReadOnlyCollection<int>? gameIds = null, CancellationToken cancellationToken = default);
    Task<TrackPageResult> GetPublicTrackPageAsync(int page = 1, int limit = 20, TrackQueryOptions? options = null, CancellationToken cancellationToken = default);
    Task<TrackItem> GetPublicTrackByIdAsync(int trackId, CancellationToken cancellationToken = default);
    Task RecordPlayAsync(int trackId, int playedSeconds, int? trackDurationSeconds, string? sessionKey = null, CancellationToken cancellationToken = default);
    Uri BuildPublicStreamUri(int trackId);
    Uri BuildPublicDownloadUri(int trackId);

    Task<TrackFilterOptions> GetTrackFilterOptionsAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<SameAlbumDuplicateGroup>> GetSameAlbumDuplicateTracksAsync(CancellationToken cancellationToken = default);
    Task BulkDeleteTracksAsync(IReadOnlyCollection<int> ids, CancellationToken cancellationToken = default);
    Task BulkMoveTracksToAlbumAsync(IReadOnlyCollection<int> trackIds, int? albumId, CancellationToken cancellationToken = default);

    Task<TrackNotesImportPreviewResult> PreviewTrackNotesImportAsync(IReadOnlyList<TrackNotesImportEntry> entries, CancellationToken cancellationToken = default);
    Task<TrackNotesImportCommitResult> CommitTrackNotesImportAsync(IReadOnlyList<TrackNotesImportEntry> entries, IReadOnlyDictionary<string, int> resolutions, string conflictMode, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<TrackNotesImportCandidate>> SearchTrackNotesImportCandidatesAsync(string keyword, int limit = 30, CancellationToken cancellationToken = default);
    Task<BinaryFileResult> ExportAllTrackNotesAsync(CancellationToken cancellationToken = default);

    Task<BinaryFileResult> ExportCatalogMetadataAsync(CancellationToken cancellationToken = default);
    Task<CatalogMetadataImportResult> PreviewCatalogMetadataImportByUuidAsync(CatalogMetadataImportPayload payload, CancellationToken cancellationToken = default);
    Task<CatalogMetadataImportResult> CommitCatalogMetadataImportByUuidAsync(CatalogMetadataImportPayload payload, CancellationToken cancellationToken = default);
    Task<CatalogMetadataRollbackResult> RollbackCatalogMetadataBatchAsync(string batchUuid, CancellationToken cancellationToken = default);
}

