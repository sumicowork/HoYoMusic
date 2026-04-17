using HoYoMusic.Desktop.Core.Models;

namespace HoYoMusic.Desktop.Core.Abstractions;

public interface ILyricsImportService
{
    Task<LyricsImportPreviewResult> PreviewImportAsync(IReadOnlyList<string> filePaths, CancellationToken cancellationToken = default);
    Task<LyricsImportCommitResult> CommitImportAsync(IReadOnlyList<string> filePaths, IReadOnlyDictionary<string, int> resolutions, CancellationToken cancellationToken = default);
}

