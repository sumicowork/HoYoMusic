using HoYoMusic.Desktop.Core.Models;

namespace HoYoMusic.Desktop.Core.Abstractions;

public interface IMusicSourceService
{
    Task<IReadOnlyList<TrackMusicSourceItem>> GetTrackMusicSourcesAsync(int trackId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<MusicSourceCategoryItem>> GetCategoriesAsync(int gameId, CancellationToken cancellationToken = default);
    Task<MusicSourceCategoryItem> CreateCategoryAsync(MusicSourceCategoryUpsertRequest payload, CancellationToken cancellationToken = default);
    Task<MusicSourceCategoryItem> UpdateCategoryAsync(int categoryId, MusicSourceCategoryUpsertRequest payload, CancellationToken cancellationToken = default);
    Task DeleteCategoryAsync(int categoryId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<MusicSourceNodeItem>> GetNodesAsync(int gameId, int categoryId, int? parentId = null, bool all = false, CancellationToken cancellationToken = default);
    Task<MusicSourceNodeItem> CreateNodeAsync(MusicSourceNodeUpsertRequest payload, CancellationToken cancellationToken = default);
    Task<MusicSourceNodeItem> UpdateNodeAsync(int nodeId, MusicSourceNodeUpsertRequest payload, CancellationToken cancellationToken = default);
    Task DeleteNodeAsync(int nodeId, CancellationToken cancellationToken = default);

    Task<MusicSourceImportPreviewResult> PreviewImportAsync(IReadOnlyList<MusicSourceImportEntry> entries, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<MusicSourceImportCandidate>> SearchImportCandidatesAsync(string keyword, int limit = 30, CancellationToken cancellationToken = default);
    Task<MusicSourceImportCommitResult> CommitImportAsync(IReadOnlyList<MusicSourceImportEntry> entries, IReadOnlyDictionary<string, int> resolutions, string conflictMode, CancellationToken cancellationToken = default);
    Task<BinaryFileResult> ExportMusicSourcesAsync(MusicSourceExportPayload payload, CancellationToken cancellationToken = default);
}

