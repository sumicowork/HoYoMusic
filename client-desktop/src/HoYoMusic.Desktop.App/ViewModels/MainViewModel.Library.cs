using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using HoYoMusic.Desktop.Core.Abstractions;
using HoYoMusic.Desktop.Core.Contracts;
using HoYoMusic.Desktop.Core.Models;
using System.Threading;
using Windows.Storage;
using Windows.System;

namespace HoYoMusic.Desktop.App.ViewModels;


public partial class MainViewModel
{
    [RelayCommand]
    private async Task OpenSearchCenterAsync()
    {
        OpenSection(SectionSearch);

        var keyword = SearchKeyword.Trim();
        if (string.IsNullOrWhiteSpace(keyword))
        {
            ErrorMessage = "请输入搜索关键词。";
            return;
        }

        PushRecentSearchKeyword(keyword);
        LibraryPage = 1;
        await LoadPublicTracksAsync(1, keyword);
    }

    [RelayCommand]
    private async Task RefreshTracksAsync()
    {
        await LoadTracksAsync();
    }

    [RelayCommand]
    private async Task RefreshRandomTracksAsync()
    {
        if (SelectedGame is null)
        {
            return;
        }

        try
        {
            var randomTracks = await _discoverService.GetRandomTracksAsync(Math.Clamp(DiscoverRandomCount, 5, 30), SelectedGame.Id);
            RandomTracks.Clear();
            foreach (var track in randomTracks)
            {
                RandomTracks.Add(track);
            }
            ApplyDiscoverFilters();
            OnPropertyChanged(nameof(DiscoverSummary));
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "刷新随机推荐失败，请稍后重试。");
        }
    }

    [RelayCommand]
    private async Task RefreshTopTracksAsync()
    {
        if (SelectedGame is null)
        {
            return;
        }

        try
        {
            var topTracks = await _discoverService.GetTopTracksAsync(Math.Clamp(DiscoverTopCount, 5, 100), SelectedGame.Id);
            TopTracks.Clear();
            foreach (var track in topTracks)
            {
                TopTracks.Add(track);
            }
            ApplyDiscoverFilters();
            OnPropertyChanged(nameof(DiscoverSummary));
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "刷新热门曲目失败，请稍后重试。");
        }
    }

    [RelayCommand]
    private async Task RefreshPublicLibraryAsync()
    {
        await LoadPublicTracksAsync(Math.Max(LibraryPage, 1));
    }

    [RelayCommand]
    private async Task SearchPublicTracksAsync()
    {
        LibraryPage = 1;
        await LoadPublicTracksAsync(1, SearchKeyword);
    }

    [RelayCommand]
    private async Task PreviousLibraryPageAsync()
    {
        if (!HasPreviousLibraryPage)
        {
            return;
        }

        LibraryPage = Math.Max(1, LibraryPage - 1);
        await LoadPublicTracksAsync(LibraryPage);
    }

    [RelayCommand]
    private async Task NextLibraryPageAsync()
    {
        if (!HasNextLibraryPage)
        {
            return;
        }

        LibraryPage += 1;
        await LoadPublicTracksAsync(LibraryPage);
    }

    [RelayCommand]
    private async Task ResetLibraryFiltersAsync()
    {
        SearchKeyword = string.Empty;
        SearchArtist = string.Empty;
        LibraryGameIdsText = string.Empty;
        YearFromText = string.Empty;
        YearToText = string.Empty;
        DurationMinText = string.Empty;
        DurationMaxText = string.Empty;
        DurationBucket = string.Empty;
        LyricsStatus = string.Empty;
        LibraryHasLyricsOnly = false;
        LibrarySortBy = SortReleaseDate;
        LibrarySortDir = "DESC";
        LibraryPage = 1;
        await LoadPublicTracksAsync(1, null);
    }

    [RelayCommand]
    private void ToggleFavoriteSortDirection()
    {
        FavoriteSortDesc = !FavoriteSortDesc;
    }

    [RelayCommand]
    private async Task BatchAddFilteredFavoritesToPlaylistAsync()
    {
        if (!IsAuthenticated)
        {
            ErrorMessage = "请先登录。";
            return;
        }

        if (SelectedPlaylist is null)
        {
            ErrorMessage = "请先选择目标歌单。";
            return;
        }

        var targets = FavoriteTracksView.ToList();
        if (targets.Count == 0)
        {
            ErrorMessage = "当前筛选没有收藏曲目。";
            return;
        }

        IsBusy = true;
        var successCount = 0;
        foreach (var track in targets)
        {
            try
            {
                await _playlistService.AddTrackAsync(SelectedPlaylist.Id, track.Id);
                successCount++;
            }
            catch
            {
                // Keep best-effort batch behavior.
            }
        }

        await LoadPlaylistDetailAsync(SelectedPlaylist.Id);
        IsBusy = false;
        SuccessMessage = $"已批量添加 {successCount}/{targets.Count} 首收藏曲目到歌单。";
    }

    [RelayCommand]
    private void RefreshDownloadCenter()
    {
        RefreshDownloadTasks();
    }

    [RelayCommand]
    private void DownloadPublicTrack(TrackItem? track)
    {
        var target = track ?? SelectedPublicTrack;
        if (target is null)
        {
            return;
        }

        _downloadService.Enqueue(target.Id, target.Title);
        RefreshDownloadTasks();
        OpenSection(SectionDownloads);
        SuccessMessage = "已加入下载队列。";
    }

    [RelayCommand]
    private void DownloadFavoriteTrack(TrackItem? track)
    {
        var target = track ?? SelectedFavoriteTrack;
        if (target is null)
        {
            return;
        }

        _downloadService.Enqueue(target.Id, target.Title);
        RefreshDownloadTasks();
        OpenSection(SectionDownloads);
        SuccessMessage = "已加入下载队列。";
    }

    [RelayCommand]
    private void DownloadPlaylistTrack(TrackItem? track)
    {
        var target = track ?? SelectedPlaylistTrack;
        if (target is null)
        {
            return;
        }

        _downloadService.Enqueue(target.Id, target.Title);
        RefreshDownloadTasks();
        OpenSection(SectionDownloads);
        SuccessMessage = "已加入下载队列。";
    }

    [RelayCommand]
    private void CancelDownload(Guid taskId)
    {
        if (_downloadService.Cancel(taskId))
        {
            RefreshDownloadTasks();
            SuccessMessage = "下载任务已取消。";
        }
    }

    [RelayCommand]
    private void CancelAllDownloads()
    {
        if (DateTimeOffset.Now > _confirmCancelAllDownloadsUntil)
        {
            _confirmCancelAllDownloadsUntil = DateTimeOffset.Now.AddSeconds(4);
            ErrorMessage = "再次点击“全部取消”以确认操作。";
            return;
        }

        foreach (var task in _downloadService.GetTasks())
        {
            _downloadService.Cancel(task.Id);
        }

        _confirmCancelAllDownloadsUntil = DateTimeOffset.MinValue;
        RefreshDownloadTasks();
        SuccessMessage = "已取消所有下载任务。";
    }

    [RelayCommand]
    private void ClearCompletedDownloads()
    {
        var removed = _downloadService.ClearCompleted();
        RefreshDownloadTasks();
        SuccessMessage = removed > 0 ? $"已清理 {removed} 条下载记录。" : "暂无可清理的已完成/已取消任务。";
    }

    [RelayCommand]
    private void CopyDownloadLink(DownloadTaskItem? task)
    {
        if (task is null)
        {
            return;
        }

        var uri = _trackService.BuildPublicDownloadUri(task.TrackId).ToString();
        var package = new Windows.ApplicationModel.DataTransfer.DataPackage();
        package.SetText(uri);
        Windows.ApplicationModel.DataTransfer.Clipboard.SetContent(package);
        SuccessMessage = "下载链接已复制。";
    }

    [RelayCommand]
    private void RetryFailedDownload(DownloadTaskItem? task)
    {
        if (task is null)
        {
            return;
        }

        if (_downloadService.Retry(task.Id))
        {
            RefreshDownloadTasks();
            SuccessMessage = "下载任务已重新排队。";
            return;
        }

        ErrorMessage = "该任务当前状态不可重试。";
    }

    [RelayCommand]
    private void OpenDownloadedFile(DownloadTaskItem? task)
    {
        if (task is null)
        {
            return;
        }

        if (_downloadService.OpenFile(task.Id))
        {
            SuccessMessage = "已打开下载文件。";
            return;
        }

        ErrorMessage = "未找到下载文件，请先完成下载。";
    }

    [RelayCommand]
    private void OpenDownloadedFolder(DownloadTaskItem? task)
    {
        if (task is null)
        {
            return;
        }

        if (_downloadService.OpenFolder(task.Id))
        {
            SuccessMessage = "已打开文件所在目录。";
            return;
        }

        ErrorMessage = "未找到下载文件目录。";
    }

    [RelayCommand]
    private async Task PreviousInboxPageAsync()
    {
        if (!HasPreviousInboxPage)
        {
            return;
        }

        InboxPage -= 1;
        await LoadInboxMessagesAsync(InboxPage);
    }

    [RelayCommand]
    private async Task NextInboxPageAsync()
    {
        if (!HasNextInboxPage)
        {
            return;
        }

        InboxPage += 1;
        await LoadInboxMessagesAsync(InboxPage);
    }

    [RelayCommand]
    private async Task RefreshInboxAsync()
    {
        await LoadInboxMessagesAsync(Math.Max(InboxPage, 1));
        await LoadUnreadMessageCountAsync();
    }

    [RelayCommand]
    private async Task OpenTrackDetailAsync(TrackItem? track)
    {
        var target = track
            ?? SelectedPublicTrack
            ?? SelectedFavoriteTrack
            ?? SelectedPlaylistTrack
            ?? SelectedTrack
            ?? SelectedAlbumTrack;
        if (target is null)
        {
            ErrorMessage = "请先选择曲目。";
            return;
        }

        await LoadTrackDetailAsync(target.Id);
    }

    [RelayCommand]
    private async Task LocateCurrentDetailTrackInLibraryAsync()
    {
        if (CurrentDetailTrack is null)
        {
            ErrorMessage = "请先加载曲目详情。";
            return;
        }

        SearchKeyword = CurrentDetailTrack.Title;
        OpenSection(SectionLibrary);
        LibraryPage = 1;
        await LoadPublicTracksAsync(1, SearchKeyword);
        SelectedPublicTrack = PublicTracks.FirstOrDefault(item => item.Id == CurrentDetailTrack.Id)
            ?? PublicTracks.FirstOrDefault();
    }

    [RelayCommand]
    private async Task ToggleFavoriteForCurrentDetailTrackAsync()
    {
        if (CurrentDetailTrack is null)
        {
            ErrorMessage = "请先加载曲目详情。";
            return;
        }

        SelectedPublicTrack = CurrentDetailTrack;
        await ToggleFavoriteAsync();
    }

    [RelayCommand]
    private async Task AddCurrentDetailTrackToPlaylistAsync()
    {
        if (CurrentDetailTrack is null)
        {
            ErrorMessage = "请先加载曲目详情。";
            return;
        }

        await AddTrackToSelectedPlaylistAsync(CurrentDetailTrack);
    }

    [RelayCommand]
    private void DownloadCurrentDetailTrack()
    {
        if (CurrentDetailTrack is null)
        {
            ErrorMessage = "请先加载曲目详情。";
            return;
        }

        _downloadService.Enqueue(CurrentDetailTrack.Id, CurrentDetailTrack.Title);
        RefreshDownloadTasks();
        OpenSection(SectionDownloads);
        SuccessMessage = "已加入下载队列。";
    }

    [RelayCommand]
    private async Task RefreshFavoritesAsync()
    {
        await LoadFavoritesAsync();
    }

    [RelayCommand]
    private async Task RefreshPlaylistsAsync()
    {
        await LoadPlaylistsAsync();
    }

    [RelayCommand]
    private async Task ToggleFavoriteAsync()
    {
        if (!IsAuthenticated)
        {
            ErrorMessage = "收藏功能需要先登录。";
            return;
        }

        var target = SelectedFavoriteTrack ?? SelectedPublicTrack ?? SelectedTrack;
        if (target is null)
        {
            ErrorMessage = "请先选择曲目。";
            return;
        }

        IsBusy = true;
        try
        {
            var result = await _favoriteService.ToggleAsync(target.Id);
            SuccessMessage = result.Favorited ? "已加入收藏。" : "已取消收藏。";
            await LoadFavoritesAsync();
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "收藏操作失败，请稍后重试。");
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task CreatePlaylistAsync()
    {
        if (!IsAuthenticated)
        {
            ErrorMessage = "歌单功能需要先登录。";
            return;
        }

        if (string.IsNullOrWhiteSpace(NewPlaylistName))
        {
            ErrorMessage = "请输入歌单名称。";
            return;
        }

        IsBusy = true;
        try
        {
            var created = await _playlistService.CreatePlaylistAsync(NewPlaylistName.Trim());
            NewPlaylistName = string.Empty;
            await LoadPlaylistsAsync();
            SelectedPlaylist = Playlists.FirstOrDefault(item => item.Id == created.Id);
            SuccessMessage = "歌单创建成功。";
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "创建歌单失败，请稍后重试。");
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task DeleteSelectedPlaylistAsync()
    {
        if (SelectedPlaylist is null)
        {
            ErrorMessage = "请先选择歌单。";
            return;
        }

        if (DateTimeOffset.Now > _confirmDeletePlaylistUntil)
        {
            _confirmDeletePlaylistUntil = DateTimeOffset.Now.AddSeconds(4);
            ErrorMessage = $"再次点击“删除”以确认删除歌单：{SelectedPlaylist.Name}";
            return;
        }

        IsBusy = true;
        try
        {
            await _playlistService.DeletePlaylistAsync(SelectedPlaylist.Id);
            await LoadPlaylistsAsync();
            PlaylistTracks.Clear();
            SelectedPlaylist = null;
            _confirmDeletePlaylistUntil = DateTimeOffset.MinValue;
            SuccessMessage = "歌单已删除。";
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "删除歌单失败，请稍后重试。");
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task AddSelectedTrackToPlaylistAsync()
    {
        if (SelectedPlaylist is null)
        {
            ErrorMessage = "请先选择歌单。";
            return;
        }

        var targetTrack = SelectedPublicTrack ?? SelectedFavoriteTrack ?? SelectedTrack;
        if (targetTrack is null)
        {
            ErrorMessage = "请先选择要添加的曲目。";
            return;
        }

        IsBusy = true;
        try
        {
            await _playlistService.AddTrackAsync(SelectedPlaylist.Id, targetTrack.Id);
            await LoadPlaylistDetailAsync(SelectedPlaylist.Id);
            await LoadPlaylistsAsync();
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "添加曲目到歌单失败，请稍后重试。");
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task RemovePlaylistTrackAsync()
    {
        if (SelectedPlaylist is null || SelectedPlaylistTrack is null)
        {
            ErrorMessage = "请先选择歌单中的曲目。";
            return;
        }

        IsBusy = true;
        try
        {
            await _playlistService.RemoveTrackAsync(SelectedPlaylist.Id, SelectedPlaylistTrack.Id);
            await LoadPlaylistDetailAsync(SelectedPlaylist.Id);
            await LoadPlaylistsAsync();
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "移除歌单曲目失败，请稍后重试。");
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task UpdateSelectedPlaylistAsync()
    {
        if (!IsAuthenticated || SelectedPlaylist is null)
        {
            ErrorMessage = "请先选择歌单并登录。";
            return;
        }

        IsBusy = true;
        try
        {
            await _playlistService.UpdatePlaylistAsync(SelectedPlaylist.Id, PlaylistEditName, PlaylistEditDescription);
            await LoadPlaylistsAsync();
            SuccessMessage = "歌单信息已更新。";
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "更新歌单失败，请稍后重试。");
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task DuplicateSelectedPlaylistAsync()
    {
        if (!IsAuthenticated || SelectedPlaylist is null)
        {
            ErrorMessage = "请先选择歌单并登录。";
            return;
        }

        IsBusy = true;
        try
        {
            var detail = await _playlistService.GetPlaylistByIdAsync(SelectedPlaylist.Id);
            var cloned = await _playlistService.CreatePlaylistAsync($"{SelectedPlaylist.Name} - 副本", SelectedPlaylist.Description);
            foreach (var track in detail.Tracks)
            {
                try
                {
                    await _playlistService.AddTrackAsync(cloned.Id, track.Id);
                }
                catch
                {
                    // Keep best-effort duplication.
                }
            }

            await LoadPlaylistsAsync();
            SuccessMessage = "歌单副本创建成功。";
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "复制歌单失败，请稍后重试。");
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task MoveSelectedPlaylistTrackUpAsync()
    {
        await ReorderSelectedPlaylistTrackAsync(-1);
    }

    [RelayCommand]
    private async Task MoveSelectedPlaylistTrackDownAsync()
    {
        await ReorderSelectedPlaylistTrackAsync(1);
    }

    [RelayCommand]
    private async Task BatchAddPublicTracksToPlaylistAsync()
    {
        if (!IsAuthenticated || SelectedPlaylist is null)
        {
            ErrorMessage = "请先登录并选择目标歌单。";
            return;
        }

        if (PublicTracks.Count == 0)
        {
            ErrorMessage = "当前没有曲库结果可添加。";
            return;
        }

        IsBusy = true;
        var added = 0;
        foreach (var track in PublicTracks)
        {
            try
            {
                await _playlistService.AddTrackAsync(SelectedPlaylist.Id, track.Id);
                added++;
            }
            catch
            {
                // Keep best-effort batch behavior.
            }
        }

        await LoadPlaylistDetailAsync(SelectedPlaylist.Id);
        IsBusy = false;
        SuccessMessage = $"已添加 {added}/{PublicTracks.Count} 首曲库曲目到歌单。";
    }

    [RelayCommand]
    private void ExportCurrentPlaylistText()
    {
        if (SelectedPlaylist is null)
        {
            ErrorMessage = "请先选择歌单。";
            return;
        }

        var lines = PlaylistTracksView.Select((track, index) => $"{index + 1}. {track.Title} - {track.ArtistsDisplay}");
        var content = string.Join(Environment.NewLine, lines);
        if (string.IsNullOrWhiteSpace(content))
        {
            ErrorMessage = "当前歌单没有可导出曲目。";
            return;
        }

        var dataPackage = new Windows.ApplicationModel.DataTransfer.DataPackage();
        dataPackage.SetText(content);
        Windows.ApplicationModel.DataTransfer.Clipboard.SetContent(dataPackage);
        SuccessMessage = "歌单文本已复制到剪贴板。";
    }

    private async Task ReorderSelectedPlaylistTrackAsync(int delta)
    {
        if (!IsAuthenticated || SelectedPlaylist is null || SelectedPlaylistTrack is null)
        {
            return;
        }

        var tracks = PlaylistTracks.ToList();
        var index = tracks.FindIndex(item => item.Id == SelectedPlaylistTrack.Id);
        if (index < 0)
        {
            return;
        }

        var targetIndex = index + delta;
        if (targetIndex < 0 || targetIndex >= tracks.Count)
        {
            return;
        }

        (tracks[index], tracks[targetIndex]) = (tracks[targetIndex], tracks[index]);
        try
        {
            await _playlistService.ReorderTracksAsync(SelectedPlaylist.Id, tracks.Select(item => item.Id).ToList());
            await LoadPlaylistDetailAsync(SelectedPlaylist.Id);
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "调整歌单顺序失败，请稍后重试。");
        }
    }

    private async Task LoadTracksAsync()
    {
        IsBusy = true;
        ErrorMessage = string.Empty;

        try
        {
            var tracks = await _trackService.GetTracksAsync(gameIds: GetSelectedGameIds());
            Tracks.Clear();
            foreach (var track in tracks)
            {
                Tracks.Add(track);
            }
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "加载曲目失败，请稍后重试。");
        }
        catch (Exception ex)
        {
            ErrorMessage = $"加载曲目失败：{ex.Message}";
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task LoadPublicTracksAsync(int page = 1, string? search = null)
    {
        IsLibraryLoading = true;
        ShowLibraryStatus = true;
        LibraryStatusMessage = "正在加载曲库...";
        try
        {
            var query = new TrackQueryOptions
            {
                Search = search ?? SearchKeyword,
                GameIds = ParseGameIdsOrDefault(),
                Artist = SearchArtist,
                YearFrom = ParsePositiveIntOrNull(YearFromText),
                YearTo = ParsePositiveIntOrNull(YearToText),
                DurationMin = ParsePositiveIntOrNull(DurationMinText),
                DurationMax = ParsePositiveIntOrNull(DurationMaxText),
                DurationBucket = string.IsNullOrWhiteSpace(DurationBucket) ? null : DurationBucket,
                LyricsStatus = string.IsNullOrWhiteSpace(LyricsStatus) ? null : LyricsStatus,
                HasLyrics = LibraryHasLyricsOnly ? true : null,
                SortBy = string.IsNullOrWhiteSpace(LibrarySortBy) ? SortReleaseDate : LibrarySortBy,
                SortDir = string.Equals(LibrarySortDir, "ASC", StringComparison.OrdinalIgnoreCase) ? "ASC" : "DESC",
            };

            var pageResult = await _trackService.GetPublicTrackPageAsync(page: Math.Max(1, page), limit: Math.Clamp(LibraryLimit, 10, 100), options: query);
            PublicTracks.Clear();
            foreach (var track in pageResult.Tracks)
            {
                PublicTracks.Add(track);
            }

            LibraryPage = pageResult.Pagination?.Page > 0 ? pageResult.Pagination.Page : Math.Max(1, page);
            LibraryTotalPages = Math.Max(1, pageResult.Pagination?.TotalPages ?? 1);
            LibraryTotal = Math.Max(0, pageResult.Pagination?.Total ?? PublicTracks.Count);

            if (PublicTracks.Count == 0)
            {
                ShowLibraryStatus = true;
                LibraryStatusMessage = "未找到匹配曲目。";
            }
            else
            {
                ShowLibraryStatus = false;
                LibraryStatusMessage = string.Empty;
            }
        }
        catch (ApiException ex)
        {
            ShowLibraryStatus = true;
            LibraryStatusMessage = HoYoMusic.Desktop.Core.Contracts.ApiErrorMapper.Resolve(ex, "加载曲库失败，请稍后重试。");
            await HandleApiExceptionAsync(ex, "加载曲库失败，请稍后重试。");
        }
        catch (Exception ex)
        {
            ErrorMessage = $"加载公开曲目失败：{ex.Message}";
            ShowLibraryStatus = true;
            LibraryStatusMessage = "加载曲库失败，请稍后重试。";
        }
        finally
        {
            IsLibraryLoading = false;
        }
    }

    private async Task LoadFavoritesAsync()
    {
        IsFavoritesLoading = true;
        ShowFavoritesStatus = true;
        FavoritesStatusMessage = "正在加载收藏...";
        if (!IsAuthenticated)
        {
            FavoriteTracks.Clear();
            FavoriteTracksView.Clear();
            FavoritesStatusMessage = "请先登录后查看收藏。";
            IsFavoritesLoading = false;
            return;
        }

        try
        {
            var tracks = await _favoriteService.GetFavoritesAsync();
            FavoriteTracks.Clear();
            foreach (var track in tracks)
            {
                FavoriteTracks.Add(track);
            }

            ApplyFavoriteFilters();
            OnPropertyChanged(nameof(ProfileSummary));

            if (FavoriteTracks.Count == 0)
            {
                ShowFavoritesStatus = true;
                FavoritesStatusMessage = "你还没有收藏任何曲目。";
            }
            else
            {
                ShowFavoritesStatus = false;
                FavoritesStatusMessage = string.Empty;
            }
        }
        catch (ApiException ex)
        {
            ShowFavoritesStatus = true;
            FavoritesStatusMessage = HoYoMusic.Desktop.Core.Contracts.ApiErrorMapper.Resolve(ex, "加载收藏失败，请稍后重试。");
            await HandleApiExceptionAsync(ex, "加载收藏失败，请稍后重试。");
        }
        finally
        {
            IsFavoritesLoading = false;
        }
    }

    private async Task LoadPlaylistsAsync()
    {
        IsPlaylistsLoading = true;
        ShowPlaylistsStatus = true;
        PlaylistsStatusMessage = "正在加载歌单...";
        if (!IsAuthenticated)
        {
            Playlists.Clear();
            PlaylistsView.Clear();
            PlaylistsStatusMessage = "请先登录后查看歌单。";
            IsPlaylistsLoading = false;
            return;
        }

        try
        {
            var playlists = await _playlistService.GetPlaylistsAsync();
            Playlists.Clear();
            foreach (var playlist in playlists)
            {
                Playlists.Add(playlist);
            }

            ApplyPlaylistFilters();
            OnPropertyChanged(nameof(ProfileSummary));

            if (Playlists.Count == 0)
            {
                ShowPlaylistsStatus = true;
                PlaylistsStatusMessage = "还没有歌单，先创建一个吧。";
            }
            else
            {
                ShowPlaylistsStatus = false;
                PlaylistsStatusMessage = string.Empty;
            }

            OnPropertyChanged(nameof(HasSelectedPlaylist));
            OnPropertyChanged(nameof(SelectedPlaylistSummary));
        }
        catch (ApiException ex)
        {
            ShowPlaylistsStatus = true;
            PlaylistsStatusMessage = HoYoMusic.Desktop.Core.Contracts.ApiErrorMapper.Resolve(ex, "加载歌单失败，请稍后重试。");
            await HandleApiExceptionAsync(ex, "加载歌单失败，请稍后重试。");
        }
        finally
        {
            IsPlaylistsLoading = false;
        }
    }

    private async Task LoadPlaylistDetailAsync(int playlistId)
    {
        try
        {
            var detail = await _playlistService.GetPlaylistByIdAsync(playlistId);
            PlaylistTracks.Clear();
            foreach (var track in detail.Tracks)
            {
                PlaylistTracks.Add(track);
            }

            ApplyPlaylistTrackFilters();
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "加载歌单详情失败，请稍后重试。");
        }
    }

    private async Task LoadInboxMessagesAsync(int page = 1)
    {
        IsInboxLoading = true;
        ShowInboxStatus = true;
        InboxStatusMessage = "正在加载消息...";

        if (!IsAuthenticated)
        {
            InboxMessages.Clear();
            InboxStatusMessage = "请先登录后查看消息。";
            IsInboxLoading = false;
            return;
        }

        try
        {
            var data = await _messageService.GetInboxMessagesAsync(page, 20);
            InboxPage = data.Pagination?.Page > 0 ? data.Pagination.Page : page;
            InboxTotalPages = Math.Max(1, data.Pagination?.TotalPages ?? 1);
            InboxTotal = Math.Max(0, data.Pagination?.Total ?? data.Items.Count);

            IEnumerable<InboxMessageItem> items = data.Items;
            if (ShowUnreadOnly)
            {
                items = items.Where(item => !item.IsRead);
            }

            if (!string.IsNullOrWhiteSpace(MessageSearchText))
            {
                var keyword = MessageSearchText.Trim();
                items = items.Where(item =>
                    item.Title.Contains(keyword, StringComparison.OrdinalIgnoreCase) ||
                    item.Content.Contains(keyword, StringComparison.OrdinalIgnoreCase));
            }

            InboxMessages.Clear();
            foreach (var item in items)
            {
                InboxMessages.Add(item);
            }

            if (InboxMessages.Count == 0)
            {
                ShowInboxStatus = true;
                InboxStatusMessage = "暂无站内消息。";
            }
            else
            {
                ShowInboxStatus = false;
                InboxStatusMessage = string.Empty;
            }
        }
        catch (ApiException ex)
        {
            ShowInboxStatus = true;
            InboxStatusMessage = HoYoMusic.Desktop.Core.Contracts.ApiErrorMapper.Resolve(ex, "加载消息失败，请稍后重试。");
            await HandleApiExceptionAsync(ex, "加载消息失败，请稍后重试。");
        }
        finally
        {
            IsInboxLoading = false;
        }
    }

    private async Task LoadTrackDetailAsync(int trackId)
    {
        IsTrackDetailLoading = true;
        ShowTrackDetailStatus = true;
        TrackDetailStatusMessage = "正在加载曲目详情...";

        try
        {
            CurrentDetailTrack = await _trackService.GetPublicTrackByIdAsync(trackId);

            var lyricsTask = _lyricsService.GetLyricsAsync(trackId);
            var creditsTask = _creditsService.GetCreditsAsync(trackId);
            var sourcesTask = _musicSourceService.GetTrackMusicSourcesAsync(trackId);

            try
            {
                var lyrics = await lyricsTask;
                DetailLyrics = lyrics.Lyrics;
                DetailLyricsStatus = string.IsNullOrWhiteSpace(lyrics.LyricsStatus) ? "unknown" : lyrics.LyricsStatus;
            }
            catch (ApiException ex) when (ex.Code is "NO_LYRICS" or "INSTRUMENTAL_TRACK" or "NOT_FOUND")
            {
                DetailLyrics = ex.Code == "INSTRUMENTAL_TRACK" ? "纯音乐，无歌词。" : "暂无歌词。";
                DetailLyricsStatus = ex.Code == "INSTRUMENTAL_TRACK" ? "instrumental" : "none";
            }

            IReadOnlyList<CreditItem> credits;
            try
            {
                credits = await creditsTask;
            }
            catch (ApiException)
            {
                credits = Array.Empty<CreditItem>();
            }

            DetailCredits.Clear();
            foreach (var credit in credits)
            {
                DetailCredits.Add(credit);
            }
            OnPropertyChanged(nameof(DetailCreditsSummary));

            IReadOnlyList<TrackMusicSourceItem> sources;
            try
            {
                sources = await sourcesTask;
            }
            catch (ApiException)
            {
                sources = Array.Empty<TrackMusicSourceItem>();
            }

            DetailMusicSources.Clear();
            foreach (var source in sources)
            {
                DetailMusicSources.Add(source);
            }
            OnPropertyChanged(nameof(DetailMusicSourcesSummary));

            ShowTrackDetailStatus = false;
            TrackDetailStatusMessage = string.Empty;
        }
        catch (ApiException ex)
        {
            CurrentDetailTrack = null;
            DetailLyrics = string.Empty;
            DetailLyricsStatus = string.Empty;
            DetailCredits.Clear();
            DetailMusicSources.Clear();
            ShowTrackDetailStatus = true;
            TrackDetailStatusMessage = HoYoMusic.Desktop.Core.Contracts.ApiErrorMapper.Resolve(ex, "加载曲目详情失败，请稍后重试。");
            await HandleApiExceptionAsync(ex, "加载曲目详情失败，请稍后重试。");
        }
        finally
        {
            IsTrackDetailLoading = false;
        }
    }

    [RelayCommand]
    private async Task ToggleFavoriteForPublicTrackAsync(TrackItem? track)
    {
        SelectedPublicTrack = track ?? SelectedPublicTrack;
        await ToggleFavoriteAsync();
    }

    [RelayCommand]
    private async Task ToggleFavoriteForFavoriteTrackAsync(TrackItem? track)
    {
        SelectedFavoriteTrack = track ?? SelectedFavoriteTrack;
        await ToggleFavoriteAsync();
    }

    [RelayCommand]
    private async Task AddPublicTrackToPlaylistAsync(TrackItem? track)
    {
        var target = track ?? SelectedPublicTrack;
        if (target is null)
        {
            ErrorMessage = "请先选择曲库曲目。";
            return;
        }

        await AddTrackToSelectedPlaylistAsync(target);
    }

    [RelayCommand]
    private async Task AddFavoriteTrackToPlaylistAsync(TrackItem? track)
    {
        var target = track ?? SelectedFavoriteTrack;
        if (target is null)
        {
            ErrorMessage = "请先选择收藏曲目。";
            return;
        }

        await AddTrackToSelectedPlaylistAsync(target);
    }

    private async Task AddTrackToSelectedPlaylistAsync(TrackItem targetTrack)
    {
        if (!IsAuthenticated)
        {
            ErrorMessage = "歌单功能需要先登录。";
            return;
        }

        if (SelectedPlaylist is null)
        {
            ErrorMessage = "请先选择目标歌单。";
            return;
        }

        IsBusy = true;
        try
        {
            await _playlistService.AddTrackAsync(SelectedPlaylist.Id, targetTrack.Id);
            await LoadPlaylistDetailAsync(SelectedPlaylist.Id);
            await LoadPlaylistsAsync();
            SuccessMessage = $"已添加到歌单：{SelectedPlaylist.Name}";
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "添加到歌单失败，请稍后重试。");
        }
        finally
        {
            IsBusy = false;
        }
    }

    private void ApplyFavoriteFilters()
    {
        IEnumerable<TrackItem> query = FavoriteTracks;
        if (!string.IsNullOrWhiteSpace(FavoriteSearchText))
        {
            var keyword = FavoriteSearchText.Trim();
            query = query.Where(item =>
                item.Title.Contains(keyword, StringComparison.OrdinalIgnoreCase) ||
                item.ArtistsDisplay.Contains(keyword, StringComparison.OrdinalIgnoreCase));
        }

        query = FavoriteSortBy switch
        {
            "duration" => FavoriteSortDesc
                ? query.OrderByDescending(item => item.Duration ?? 0)
                : query.OrderBy(item => item.Duration ?? 0),
            "artist" => FavoriteSortDesc
                ? query.OrderByDescending(item => item.ArtistsDisplay)
                : query.OrderBy(item => item.ArtistsDisplay),
            _ => FavoriteSortDesc
                ? query.OrderByDescending(item => item.Title)
                : query.OrderBy(item => item.Title),
        };

        FavoriteTracksView.Clear();
        foreach (var item in query)
        {
            FavoriteTracksView.Add(item);
        }
    }

    private void ApplyPlaylistFilters()
    {
        IEnumerable<PlaylistItem> query = Playlists;
        if (!string.IsNullOrWhiteSpace(PlaylistSearchText))
        {
            var keyword = PlaylistSearchText.Trim();
            query = query.Where(item => item.Name.Contains(keyword, StringComparison.OrdinalIgnoreCase));
        }

        PlaylistsView.Clear();
        foreach (var item in query.OrderBy(item => item.Name))
        {
            PlaylistsView.Add(item);
        }
    }

    private void ApplyPlaylistTrackFilters()
    {
        IEnumerable<TrackItem> query = PlaylistTracks;
        if (!string.IsNullOrWhiteSpace(PlaylistTrackSearchText))
        {
            var keyword = PlaylistTrackSearchText.Trim();
            query = query.Where(item =>
                item.Title.Contains(keyword, StringComparison.OrdinalIgnoreCase) ||
                item.ArtistsDisplay.Contains(keyword, StringComparison.OrdinalIgnoreCase));
        }

        PlaylistTracksView.Clear();
        foreach (var item in query)
        {
            PlaylistTracksView.Add(item);
        }
    }

    private async void DebounceInboxReload()
    {
        _inboxSearchDebounceCts?.Cancel();
        _inboxSearchDebounceCts?.Dispose();
        _inboxSearchDebounceCts = new CancellationTokenSource();
        var token = _inboxSearchDebounceCts.Token;

        try
        {
            await Task.Delay(350, token);
            if (token.IsCancellationRequested)
            {
                return;
            }

            await LoadInboxMessagesAsync(Math.Max(InboxPage, 1));
        }
        catch (TaskCanceledException)
        {
            // Ignore canceled debounce runs.
        }
        catch (Exception)
        {
            // Debounce background load failing should not crash the app.
        }
    }

    private void RefreshDownloadTasks()
    {
        var allTasks = _downloadService.GetTasks();
        IEnumerable<DownloadTaskItem> query = allTasks;
        if (!string.Equals(DownloadStatusFilter, "all", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(item => string.Equals(item.Status.ToString(), DownloadStatusFilter, StringComparison.OrdinalIgnoreCase));
        }

        if (!string.IsNullOrWhiteSpace(DownloadSearchText))
        {
            var keyword = DownloadSearchText.Trim();
            query = query.Where(item => item.Title.Contains(keyword, StringComparison.OrdinalIgnoreCase));
        }

        DownloadTasks.Clear();
        foreach (var item in query)
        {
            DownloadTasks.Add(item);
        }

        OnPropertyChanged(nameof(DownloadSummary));
        OnPropertyChanged(nameof(DownloadStatusSummary));
    }

}
