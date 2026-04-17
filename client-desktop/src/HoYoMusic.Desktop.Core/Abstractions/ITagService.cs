using HoYoMusic.Desktop.Core.Models;

namespace HoYoMusic.Desktop.Core.Abstractions;

public interface ITagService
{
    Task<IReadOnlyList<TagItem>> GetTagsAsync(CancellationToken cancellationToken = default);
    Task<TagItem> GetTagByIdAsync(int tagId, CancellationToken cancellationToken = default);
    Task<TagItem> CreateTagAsync(TagUpsertRequest request, CancellationToken cancellationToken = default);
    Task<TagItem> UpdateTagAsync(int tagId, TagUpsertRequest request, CancellationToken cancellationToken = default);
    Task DeleteTagAsync(int tagId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<TagItem>> GetTrackTagsAsync(int trackId, CancellationToken cancellationToken = default);
    Task AddTagToTrackAsync(int trackId, int tagId, CancellationToken cancellationToken = default);
    Task RemoveTagFromTrackAsync(int trackId, int tagId, CancellationToken cancellationToken = default);
    Task BulkUpdateTrackTagsAsync(BulkTrackTagUpdateRequest request, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<TagGroupItem>> GetTagGroupsAsync(CancellationToken cancellationToken = default);
    Task<TagGroupItem> GetTagGroupByIdAsync(int groupId, CancellationToken cancellationToken = default);
    Task<TagGroupItem> CreateTagGroupAsync(TagGroupUpsertRequest request, CancellationToken cancellationToken = default);
    Task<TagGroupItem> UpdateTagGroupAsync(int groupId, TagGroupUpsertRequest request, CancellationToken cancellationToken = default);
    Task DeleteTagGroupAsync(int groupId, CancellationToken cancellationToken = default);
}

