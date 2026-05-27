using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using HoYoMusic.Desktop.Core.Abstractions;
using HoYoMusic.Desktop.Core.Contracts;
using HoYoMusic.Desktop.Core.Models;
using System.Text.Json;

namespace HoYoMusic.Desktop.App.ViewModels;

public partial class MainViewModel
{
    // ═══ Credits Export ═══
    [ObservableProperty]
    private string _adminExportCreditsAlbumIdsText = string.Empty;

    [ObservableProperty]
    private string _adminExportCreditsSummary = string.Empty;

    [RelayCommand]
    private async Task ExportCreditsAsync()
    {
        if (!IsAdmin) return;
        var albumIds = ParseCsvPositiveIntList(AdminExportCreditsAlbumIdsText);
        if (albumIds.Count == 0) { ErrorMessage = "请输入要导出的专辑 ID（逗号分隔）。"; return; }
        IsBusy = true;
        try
        {
            var result = await _creditsService.ExportCreditsAsync(albumIds);
            AdminExportCreditsSummary = $"导出成功：{result.FileName} ({result.Content.Length} 字节)";
            AdminExportCreditsAlbumIdsText = string.Empty;
            SuccessMessage = $"Credits 已导出为 {result.FileName}";
        }
        catch (ApiException ex) { await HandleApiExceptionAsync(ex, "导出 Credits 失败。"); }
        finally { IsBusy = false; }
    }

    // ═══ Track Notes Export ═══
    [ObservableProperty]
    private bool _adminExportTrackNotesLoading;

    [RelayCommand]
    private async Task ExportTrackNotesAsync()
    {
        if (!IsAdmin) return;
        AdminExportTrackNotesLoading = true;
        try
        {
            var result = await _trackService.ExportAllTrackNotesAsync();
            SuccessMessage = $"Track Notes 已导出：{result.FileName} ({result.Content.Length} 字节)";
        }
        catch (ApiException ex) { await HandleApiExceptionAsync(ex, "导出 Track Notes 失败。"); }
        finally { AdminExportTrackNotesLoading = false; }
    }

    // ═══ Track Notes Import ═══
    [ObservableProperty]
    private string _adminImportNotesJson = string.Empty;

    [ObservableProperty]
    private string _adminImportNotesConflictMode = "append";

    [ObservableProperty]
    private string _adminImportNotesPreviewSummary = string.Empty;

    [ObservableProperty]
    private string _adminImportNotesCommitSummary = string.Empty;

    [ObservableProperty]
    private bool _adminImportNotesLoading;

    [RelayCommand]
    private async Task PreviewTrackNotesImportAsync()
    {
        if (!IsAdmin) return;
        var entries = TryParseJson<List<TrackNotesImportEntry>>(AdminImportNotesJson);
        if (entries is null) { ErrorMessage = "JSON 格式无效。"; return; }
        AdminImportNotesLoading = true;
        try
        {
            var preview = await _trackService.PreviewTrackNotesImportAsync(entries);
            var s = preview.Summary;
            AdminImportNotesPreviewSummary = $"预览：总 {s.Total}，匹配 {s.Matched}，需手动 {s.NeedsManual}，未命中 {s.NotFound}";
            SuccessMessage = "Track Notes 导入预览完成。";
        }
        catch (ApiException ex) { await HandleApiExceptionAsync(ex, "预览导入失败。"); }
        finally { AdminImportNotesLoading = false; }
    }

    [RelayCommand]
    private async Task CommitTrackNotesImportAsync()
    {
        if (!IsAdmin) return;
        var entries = TryParseJson<List<TrackNotesImportEntry>>(AdminImportNotesJson);
        if (entries is null) { ErrorMessage = "JSON 格式无效。"; return; }
        AdminImportNotesLoading = true;
        try
        {
            var result = await _trackService.CommitTrackNotesImportAsync(entries, new Dictionary<string, int>(), AdminImportNotesConflictMode);
            var cs = result.Summary;
            AdminImportNotesCommitSummary = $"提交：总 {cs.Total}，匹配 {cs.Matched}，需手动 {cs.NeedsManual}，未命中 {cs.NotFound}";
            SuccessMessage = "Track Notes 导入提交完成。";
        }
        catch (ApiException ex) { await HandleApiExceptionAsync(ex, "提交导入失败。"); }
        finally { AdminImportNotesLoading = false; }
    }

    // ═══ Catalog Metadata Import ═══
    [ObservableProperty]
    private string _adminImportMetadataJson = string.Empty;

    [ObservableProperty]
    private string _adminImportMetadataPreviewSummary = string.Empty;

    [ObservableProperty]
    private string _adminImportMetadataCommitSummary = string.Empty;

    [ObservableProperty]
    private string _adminImportMetadataRollbackUuid = string.Empty;

    [ObservableProperty]
    private string _adminImportMetadataRollbackSummary = string.Empty;

    [ObservableProperty]
    private bool _adminImportMetadataLoading;

    [RelayCommand]
    private async Task PreviewCatalogMetadataImportAsync()
    {
        if (!IsAdmin) return;
        var payload = TryParseJson<CatalogMetadataImportPayload>(AdminImportMetadataJson);
        if (payload is null) { ErrorMessage = "JSON 格式无效。"; return; }
        AdminImportMetadataLoading = true;
        try
        {
            var result = await _trackService.PreviewCatalogMetadataImportByUuidAsync(payload);
            AdminImportMetadataPreviewSummary = $"预览完成：BatchUuid={result.BatchUuid ?? "N/A"}";
            SuccessMessage = "Catalog Metadata 导入预览完成。";
        }
        catch (ApiException ex) { await HandleApiExceptionAsync(ex, "预览导入失败。"); }
        finally { AdminImportMetadataLoading = false; }
    }

    [RelayCommand]
    private async Task CommitCatalogMetadataImportAsync()
    {
        if (!IsAdmin) return;
        var payload = TryParseJson<CatalogMetadataImportPayload>(AdminImportMetadataJson);
        if (payload is null) { ErrorMessage = "JSON 格式无效。"; return; }
        AdminImportMetadataLoading = true;
        try
        {
            var result = await _trackService.CommitCatalogMetadataImportByUuidAsync(payload);
            AdminImportMetadataCommitSummary = $"提交完成：BatchUuid={result.BatchUuid ?? "N/A"}";
            SuccessMessage = "Catalog Metadata 导入提交完成。";
        }
        catch (ApiException ex) { await HandleApiExceptionAsync(ex, "提交导入失败。"); }
        finally { AdminImportMetadataLoading = false; }
    }

    [RelayCommand]
    private async Task RollbackCatalogMetadataAsync()
    {
        if (!IsAdmin) return;
        if (string.IsNullOrWhiteSpace(AdminImportMetadataRollbackUuid)) { ErrorMessage = "请输入 Batch UUID。"; return; }
        AdminImportMetadataLoading = true;
        try
        {
            var result = await _trackService.RollbackCatalogMetadataBatchAsync(AdminImportMetadataRollbackUuid.Trim());
            AdminImportMetadataRollbackSummary = $"回滚完成：专辑 {result.AlbumsReverted}，曲目 {result.TracksReverted}";
            AdminImportMetadataRollbackUuid = string.Empty;
            SuccessMessage = "Catalog Metadata 回滚完成。";
        }
        catch (ApiException ex) { await HandleApiExceptionAsync(ex, "回滚失败。"); }
        finally { AdminImportMetadataLoading = false; }
    }

    // ═══ Track Tags Manager ═══
    [ObservableProperty]
    private string _adminTrackTagsTrackIdText = string.Empty;

    [ObservableProperty]
    private string _adminTrackTagsAddIdText = string.Empty;

    [ObservableProperty]
    private string _adminTrackTagsStatusMessage = string.Empty;

    [ObservableProperty]
    private bool _showAdminTrackTagsStatus;

    [ObservableProperty]
    private bool _isAdminTrackTagsLoading;

    public ObservableCollection<TagItem> AdminTrackTags { get; } = [];

    [RelayCommand]
    private async Task LoadTrackTagsAsync()
    {
        if (!IsAdmin) return;
        var trackId = ParsePositiveIntOrNull(AdminTrackTagsTrackIdText);
        if (!trackId.HasValue) { ErrorMessage = "请输入有效的曲目 ID。"; return; }
        IsAdminTrackTagsLoading = true;
        try
        {
            var allTags = await _tagService.GetTagsAsync();
            var trackTags = await _tagService.GetTrackTagsAsync(trackId.Value);
            AdminTrackTags.Clear();
            foreach (var tag in allTags)
            {
                var isTagged = trackTags.Any(t => t.Id == tag.Id);
                AdminTrackTags.Add(new TagItem
                {
                    Id = tag.Id, Name = tag.Name, Color = tag.Color, Description = isTagged ? "[已标记]" : "",
                    GroupId = tag.GroupId, ParentId = tag.ParentId, Icon = tag.Icon, DisplayOrder = tag.DisplayOrder,
                });
            }
            ShowAdminTrackTagsStatus = AdminTrackTags.Count == 0;
            AdminTrackTagsStatusMessage = AdminTrackTags.Count == 0 ? "没有标签数据。" : string.Empty;
        }
        catch (ApiException ex) { await HandleApiExceptionAsync(ex, "加载标签失败。"); }
        finally { IsAdminTrackTagsLoading = false; }
    }

    [RelayCommand]
    private async Task AddTrackTagAsync()
    {
        if (!IsAdmin) return;
        var trackId = ParsePositiveIntOrNull(AdminTrackTagsTrackIdText);
        var tagId = ParsePositiveIntOrNull(AdminTrackTagsAddIdText);
        if (!trackId.HasValue || !tagId.HasValue) { ErrorMessage = "请输入曲目 ID 和标签 ID。"; return; }
        IsBusy = true;
        try
        {
            await _tagService.AddTagToTrackAsync(trackId.Value, tagId.Value);
            SuccessMessage = $"已添加标签 #{tagId.Value} 到曲目 #{trackId.Value}。";
            await LoadTrackTagsAsync();
        }
        catch (ApiException ex) { await HandleApiExceptionAsync(ex, "添加标签失败。"); }
        finally { IsBusy = false; }
    }

    [RelayCommand]
    private async Task RemoveTrackTagAsync(TagItem? tag)
    {
        if (!IsAdmin || tag is null) return;
        var trackId = ParsePositiveIntOrNull(AdminTrackTagsTrackIdText);
        if (!trackId.HasValue) return;
        IsBusy = true;
        try
        {
            await _tagService.RemoveTagFromTrackAsync(trackId.Value, tag.Id);
            SuccessMessage = $"已移除标签 #{tag.Id}。";
            await LoadTrackTagsAsync();
        }
        catch (ApiException ex) { await HandleApiExceptionAsync(ex, "移除标签失败。"); }
        finally { IsBusy = false; }
    }

    // ═══ Credits Viewer ═══
    [ObservableProperty]
    private string _adminCreditsViewTrackIdText = string.Empty;

    [ObservableProperty]
    private bool _isAdminCreditsViewLoading;

    public ObservableCollection<CreditItem> AdminCreditsViewItems { get; } = [];

    [RelayCommand]
    private async Task LoadCreditsForViewAsync()
    {
        if (!IsAdmin) return;
        var trackId = ParsePositiveIntOrNull(AdminCreditsViewTrackIdText);
        if (!trackId.HasValue) { ErrorMessage = "请输入有效的曲目 ID。"; return; }
        IsAdminCreditsViewLoading = true;
        try
        {
            var credits = await _creditsService.GetCreditsAsync(trackId.Value);
            AdminCreditsViewItems.Clear();
            foreach (var c in credits) AdminCreditsViewItems.Add(c);
        }
        catch (ApiException ex) { await HandleApiExceptionAsync(ex, "加载 Credits 失败。"); }
        finally { IsAdminCreditsViewLoading = false; }
    }

    [RelayCommand]
    private void ClearCreditsView()
    {
        AdminCreditsViewItems.Clear();
        AdminCreditsViewTrackIdText = string.Empty;
    }

    // ═══ Track Upload ═══
    [ObservableProperty]
    private string _adminTrackUploadPathsText = string.Empty;

    [ObservableProperty]
    private string _adminTrackUploadAlbumIdText = string.Empty;

    [ObservableProperty]
    private string _adminTrackUploadSummary = string.Empty;

    [ObservableProperty]
    private bool _adminTrackUploadAutoCredits = true;

    public ObservableCollection<TrackCreditPreviewItem> AdminTrackCreditPreview { get; } = [];

    [RelayCommand]
    private async Task PreviewTrackCreditsAsync()
    {
        if (!IsAdmin) return;
        var paths = ParsePathList(AdminTrackUploadPathsText);
        if (paths.Count == 0) { ErrorMessage = "请输入音频文件路径。"; return; }
        IsBusy = true;
        try
        {
            var results = await _trackService.PreviewTrackCreditsAsync(paths);
            AdminTrackCreditPreview.Clear();
            foreach (var item in results) AdminTrackCreditPreview.Add(item);
            SuccessMessage = $"Credits 预览完成：{results.Count} 个文件。";
        }
        catch (ApiException ex) { await HandleApiExceptionAsync(ex, "预览 Credits 失败。"); }
        finally { IsBusy = false; }
    }

    [RelayCommand]
    private async Task UploadTrackAsync()
    {
        if (!IsAdmin) return;
        var paths = ParsePathList(AdminTrackUploadPathsText);
        if (paths.Count == 0) { ErrorMessage = "请输入音频文件路径（换行/逗号/分号分隔）。"; return; }
        var albumId = ParsePositiveIntOrNull(AdminTrackUploadAlbumIdText);
        IsBusy = true;
        try
        {
            var result = await _trackService.UploadTracksAsync(paths, albumId, AdminTrackUploadAutoCredits);
            var titles = string.Join(", ", result.Tracks.Select(t => t.Title));
            AdminTrackUploadSummary = $"上传成功：{result.Tracks.Count} 首 — {titles}";
            AdminTrackUploadPathsText = string.Empty;
            AdminTrackUploadAlbumIdText = string.Empty;
            SuccessMessage = $"曲目已上传：{titles}";
        }
        catch (ApiException ex) { await HandleApiExceptionAsync(ex, "上传失败。"); }
        finally { IsBusy = false; }
    }

    // ═══ Helpers ═══
    private static T? TryParseJson<T>(string json) where T : class
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try { return JsonSerializer.Deserialize<T>(json); }
        catch { return null; }
    }
}
