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
    private void EnqueuePublicTrack(TrackItem? track)
    {
        var target = track ?? SelectedPublicTrack;
        if (target is null)
        {
            return;
        }

        AppendToQueue(new PlaybackQueueItem(target.Id, target.Title, target.ArtistsDisplay, target.Duration));
        SuccessMessage = "已加入播放队列。";
    }

    [RelayCommand]
    private void EnqueueFavoriteTrack(TrackItem? track)
    {
        var target = track ?? SelectedFavoriteTrack;
        if (target is null)
        {
            return;
        }

        AppendToQueue(new PlaybackQueueItem(target.Id, target.Title, target.ArtistsDisplay, target.Duration));
        SuccessMessage = "已加入播放队列。";
    }

    [RelayCommand]
    private void EnqueuePlaylistTrack(TrackItem? track)
    {
        var target = track ?? SelectedPlaylistTrack;
        if (target is null)
        {
            return;
        }

        AppendToQueue(new PlaybackQueueItem(target.Id, target.Title, target.ArtistsDisplay, target.Duration));
        SuccessMessage = "已加入播放队列。";
    }

    [RelayCommand]
    private void PlayNowNextInQueue(TrackItem? track)
    {
        var target = track ?? SelectedPublicTrack;
        if (target is null)
        {
            return;
        }

        var item = new PlaybackQueueItem(target.Id, target.Title, target.ArtistsDisplay, target.Duration);
        if (_playbackQueue.Count == 0)
        {
            _playbackQueue.Add(item);
            _playbackIndex = 0;
            SyncQueueProjection();
            PlayQueueItem(item);
            return;
        }

        var insertIndex = Math.Min(_playbackQueue.Count, Math.Max(_playbackIndex + 1, 0));
        if (PreventDuplicateQueueItems && _playbackQueue.Any(queueItem => queueItem.Id == item.Id))
        {
            return;
        }

        _playbackQueue.Insert(insertIndex, item);
        SyncQueueProjection();
        SuccessMessage = "已设置为下一首播放。";
    }

    [RelayCommand]
    private async Task StartSleepTimerAsync()
    {
        if (SleepTimerMinutes <= 0)
        {
            ErrorMessage = "请输入有效的睡眠分钟数。";
            return;
        }

        IsSleepTimerEnabled = true;
        SuccessMessage = $"睡眠定时已开启：{SleepTimerMinutes} 分钟后停止播放。";
        await Task.Delay(TimeSpan.FromMinutes(SleepTimerMinutes));
        if (!IsSleepTimerEnabled)
        {
            return;
        }

        ClearQueue();
        IsSleepTimerEnabled = false;
        SuccessMessage = "睡眠定时已到，已停止播放。";
    }

    [RelayCommand]
    private void StopSleepTimer()
    {
        IsSleepTimerEnabled = false;
    }

    [RelayCommand]
    private void ApplySleepTimerPreset(int minutes)
    {
        SleepTimerMinutes = Math.Max(0, minutes);
    }

    [RelayCommand]
    private void EnableAbLoop()
    {
        IsAbLoopEnabled = AbLoopEndSeconds > AbLoopStartSeconds;
        if (!IsAbLoopEnabled)
        {
            ErrorMessage = "请设置有效的 A-B 区间。";
            return;
        }

        SuccessMessage = "A-B 循环已开启。";
    }

    [RelayCommand]
    private void DisableAbLoop()
    {
        IsAbLoopEnabled = false;
    }

    [RelayCommand]
    private void PlayCurrentDetailTrack()
    {
        if (CurrentDetailTrack is null)
        {
            ErrorMessage = "请先加载曲目详情。";
            return;
        }

        SelectedPublicTrack = CurrentDetailTrack;
        PlayPublicTrack();
    }

    [RelayCommand]
    private void PlaySelectedTrack()
    {
        if (SelectedTrack is null)
        {
            ErrorMessage = "请先选择曲目。";
            return;
        }

        PlayFromQueue(
            Tracks.Select(track => new PlaybackQueueItem(track.Id, track.Title, track.ArtistsDisplay, track.Duration)).ToList(),
            SelectedTrack.Id);
    }

    [RelayCommand]
    private void PlayPublicTrack()
    {
        if (SelectedPublicTrack is null)
        {
            ErrorMessage = "请先选择曲库曲目。";
            return;
        }

        PlayFromQueue(
            PublicTracks.Select(track => new PlaybackQueueItem(track.Id, track.Title, track.ArtistsDisplay, track.Duration)).ToList(),
            SelectedPublicTrack.Id);
    }

    [RelayCommand]
    private void PlayPublicTrackRow(TrackItem? track)
    {
        SelectedPublicTrack = track ?? SelectedPublicTrack;
        PlayPublicTrack();
    }

    [RelayCommand]
    private void PlayAllPublicTracks()
    {
        if (PublicTracks.Count == 0)
        {
            ErrorMessage = "曲库暂无可播放曲目。";
            return;
        }

        SelectedPublicTrack = PublicTracks[0];
        PlayFromQueue(
            PublicTracks.Select(track => new PlaybackQueueItem(track.Id, track.Title, track.ArtistsDisplay, track.Duration)).ToList(),
            PublicTracks[0].Id);
    }

    [RelayCommand]
    private void PlayFavoriteTrack()
    {
        if (SelectedFavoriteTrack is null)
        {
            ErrorMessage = "请先选择收藏曲目。";
            return;
        }

        PlayFromQueue(
            FavoriteTracks.Select(track => new PlaybackQueueItem(track.Id, track.Title, track.ArtistsDisplay, track.Duration)).ToList(),
            SelectedFavoriteTrack.Id);
    }

    [RelayCommand]
    private void PlayFavoriteTrackRow(TrackItem? track)
    {
        SelectedFavoriteTrack = track ?? SelectedFavoriteTrack;
        PlayFavoriteTrack();
    }

    [RelayCommand]
    private void PlayAllFavorites()
    {
        if (FavoriteTracks.Count == 0)
        {
            ErrorMessage = "收藏列表暂无可播放曲目。";
            return;
        }

        SelectedFavoriteTrack = FavoriteTracks[0];
        PlayFromQueue(
            FavoriteTracks.Select(track => new PlaybackQueueItem(track.Id, track.Title, track.ArtistsDisplay, track.Duration)).ToList(),
            FavoriteTracks[0].Id);
    }

    [RelayCommand]
    private void PlayPlaylistTrack()
    {
        if (SelectedPlaylistTrack is null)
        {
            ErrorMessage = "请先选择歌单曲目。";
            return;
        }

        PlayFromQueue(
            PlaylistTracks.Select(track => new PlaybackQueueItem(track.Id, track.Title, track.ArtistsDisplay, track.Duration)).ToList(),
            SelectedPlaylistTrack.Id);
    }

    [RelayCommand]
    private void PlayPlaylistTrackRow(TrackItem? track)
    {
        SelectedPlaylistTrack = track ?? SelectedPlaylistTrack;
        PlayPlaylistTrack();
    }

    [RelayCommand]
    private void PlayAllPlaylistTracks()
    {
        if (PlaylistTracks.Count == 0)
        {
            ErrorMessage = "当前歌单暂无可播放曲目。";
            return;
        }

        SelectedPlaylistTrack = PlaylistTracks[0];
        PlayFromQueue(
            PlaylistTracks.Select(track => new PlaybackQueueItem(track.Id, track.Title, track.ArtistsDisplay, track.Duration)).ToList(),
            PlaylistTracks[0].Id);
    }

    [RelayCommand]
    private void PlayNext()
    {
        if (!TryMoveToNext())
        {
            return;
        }

        PlayQueueItem(_playbackQueue[_playbackIndex]);
    }

    [RelayCommand]
    private void PlayPrevious()
    {
        if (!TryMoveToPrevious())
        {
            return;
        }

        PlayQueueItem(_playbackQueue[_playbackIndex]);
    }

    [RelayCommand]
    private void TogglePlayMode()
    {
        PlayMode = PlayMode switch
        {
            PlayModeSequence => PlayModeLoop,
            PlayModeLoop => PlayModeShuffle,
            PlayModeShuffle => PlayModeSingle,
            _ => PlayModeSequence,
        };
    }

    [RelayCommand]
    private void HandleTrackEnded()
    {
        if (!PlaybackQueueRules.TryGetIndexOnTrackEnded(PlayMode, _playbackIndex, _playbackQueue.Count, _random, out var targetIndex))
        {
            return;
        }

        _playbackIndex = targetIndex;
        PlayQueueItem(_playbackQueue[_playbackIndex]);
    }

    [RelayCommand]
    private void PlayAlbumTrack()
    {
        if (SelectedAlbumTrack is null)
        {
            ErrorMessage = "请先选择专辑曲目。";
            return;
        }

        PlayFromQueue(
            AlbumTracks.Select(track => new PlaybackQueueItem(track.Id, track.Title, track.ArtistsDisplay, track.Duration)).ToList(),
            SelectedAlbumTrack.Id);
    }

    [RelayCommand]
    private void PlayAlbumTrackRow(AlbumTrackRow? row)
    {
        var target = row ?? SelectedAlbumTrackRow;
        if (target is null)
        {
            return;
        }

        SelectedAlbumTrack = AlbumTracks.FirstOrDefault(item => item.Id == target.Id);
        if (SelectedAlbumTrack is null)
        {
            return;
        }

        PlayAlbumTrack();
    }

    [RelayCommand]
    private void PlayAlbumAll()
    {
        if (AlbumTracks.Count == 0)
        {
            return;
        }

        PlayFromQueue(
            AlbumTracks.Select(track => new PlaybackQueueItem(track.Id, track.Title, track.ArtistsDisplay, track.Duration)).ToList(),
            AlbumTracks[0].Id);
    }

    [RelayCommand]
    private void PlayQueueItemById(int trackId)
    {
        if (_playbackQueue.Count == 0)
        {
            return;
        }

        var index = _playbackQueue.FindIndex(item => item.Id == trackId);
        if (index < 0)
        {
            return;
        }

        _playbackIndex = index;
        PlayQueueItem(_playbackQueue[_playbackIndex]);
    }

    [RelayCommand]
    private void RemoveQueueItem(int trackId)
    {
        var index = _playbackQueue.FindIndex(item => item.Id == trackId);
        if (index < 0)
        {
            return;
        }

        var decision = PlaybackQueueRules.DecideAfterRemoval(_playbackIndex, index, _playbackQueue.Count);
        if (!decision.IsValidRemoval)
        {
            return;
        }

        _playbackQueue.RemoveAt(index);
        if (decision.QueueBecomesEmpty)
        {
            _playbackIndex = -1;
            PlaybackQueue.Clear();
            PlaybackQueueView.Clear();
            CurrentTrackId = null;
            ResetPlaySession();
            SyncAlbumTrackPlayingState();
            NowPlaying = "暂无播放";
            StopRequested?.Invoke(this, EventArgs.Empty);
            return;
        }

        _playbackIndex = decision.NextIndex;

        SyncQueueProjection();
        if (decision.ShouldStartReplacementPlayback)
        {
            PlayQueueItem(_playbackQueue[_playbackIndex]);
        }
    }

    [RelayCommand]
    private void MoveQueueItemUp(int trackId)
    {
        MoveQueueItemByDelta(trackId, -1);
    }

    [RelayCommand]
    private void MoveQueueItemDown(int trackId)
    {
        MoveQueueItemByDelta(trackId, 1);
    }

    [RelayCommand]
    private void ClearQueue()
    {
        if (_playbackQueue.Count > 0 && DateTimeOffset.Now > _confirmClearQueueUntil)
        {
            _confirmClearQueueUntil = DateTimeOffset.Now.AddSeconds(4);
            ErrorMessage = "再次点击“清空队列”以确认操作。";
            return;
        }

        _confirmClearQueueUntil = DateTimeOffset.MinValue;
        _playbackQueue.Clear();
        _playbackIndex = -1;
        PlaybackQueue.Clear();
        PlaybackQueueView.Clear();
        CurrentTrackId = null;
        ResetPlaySession();
        SyncAlbumTrackPlayingState();
        NowPlaying = "暂无播放";
        StopRequested?.Invoke(this, EventArgs.Empty);
    }

    [RelayCommand]
    private void ReverseQueue()
    {
        if (_playbackQueue.Count <= 1)
        {
            return;
        }

        _playbackQueue.Reverse();
        _playbackIndex = _playbackQueue.FindIndex(item => item.Id == CurrentTrackId);
        SyncQueueProjection();
        SuccessMessage = "队列已反转。";
    }

    [RelayCommand]
    private void ShuffleQueue()
    {
        if (_playbackQueue.Count <= 1)
        {
            return;
        }

        var currentId = CurrentTrackId;
        var shuffled = _playbackQueue.OrderBy(_ => _random.Next()).ToList();
        _playbackQueue.Clear();
        _playbackQueue.AddRange(shuffled);
        _playbackIndex = currentId.HasValue ? _playbackQueue.FindIndex(item => item.Id == currentId.Value) : -1;
        SyncQueueProjection();
        SuccessMessage = "队列已随机排序。";
    }

    [RelayCommand]
    private void ExportQueueText()
    {
        if (_playbackQueue.Count == 0)
        {
            ErrorMessage = "当前队列为空。";
            return;
        }

        var content = string.Join(Environment.NewLine, _playbackQueue.Select((item, index) => $"{index + 1}. {item.Title} - {item.ArtistsDisplay}"));
        var package = new Windows.ApplicationModel.DataTransfer.DataPackage();
        package.SetText(content);
        Windows.ApplicationModel.DataTransfer.Clipboard.SetContent(package);
        SuccessMessage = "队列文本已复制。";
    }

    [RelayCommand]
    private Task PlayPlaylistFromSelectedTrackAsync()
    {
        if (SelectedPlaylistTrack is null)
        {
            ErrorMessage = "请先选择歌单曲目。";
            return Task.CompletedTask;
        }

        var startIndex = PlaylistTracksView.IndexOf(SelectedPlaylistTrack);
        if (startIndex < 0)
        {
            startIndex = 0;
        }

        var queue = PlaylistTracksView.Skip(startIndex)
            .Select(track => new PlaybackQueueItem(track.Id, track.Title, track.ArtistsDisplay, track.Duration))
            .ToList();
        if (queue.Count == 0)
        {
            return Task.CompletedTask;
        }

        PlayFromQueue(queue, queue[0].Id);
        return Task.CompletedTask;
    }

    [RelayCommand]
    private async Task SaveQueueAsPlaylistAsync()
    {
        if (!IsAuthenticated)
        {
            ErrorMessage = "请先登录。";
            return;
        }

        if (_playbackQueue.Count == 0)
        {
            ErrorMessage = "当前队列为空。";
            return;
        }

        IsBusy = true;
        try
        {
            var playlist = await _playlistService.CreatePlaylistAsync($"队列 {DateTime.Now:MMdd-HHmm}");
            foreach (var item in _playbackQueue)
            {
                try
                {
                    await _playlistService.AddTrackAsync(playlist.Id, item.Id);
                }
                catch
                {
                    // Keep best-effort save behavior.
                }
            }

            await LoadPlaylistsAsync();
            SuccessMessage = "队列已保存为新歌单。";
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "保存队列为歌单失败，请稍后重试。");
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private void PlayFilteredPublicTracks()
    {
        if (PublicTracks.Count == 0)
        {
            ErrorMessage = "当前无可播放曲目。";
            return;
        }

        PlayFromQueue(
            PublicTracks.Select(track => new PlaybackQueueItem(track.Id, track.Title, track.ArtistsDisplay, track.Duration)).ToList(),
            PublicTracks[0].Id);
    }

    [RelayCommand]
    private void QueueFilteredPublicTracks()
    {
        foreach (var track in PublicTracks)
        {
            AppendToQueue(new PlaybackQueueItem(track.Id, track.Title, track.ArtistsDisplay, track.Duration));
        }

        SuccessMessage = "当前曲库结果已加入队列。";
    }

    private void PlayTrackById(int trackId, string nowPlayingText, int? durationSeconds)
    {
        try
        {
            var streamUri = _trackService.BuildPublicStreamUri(trackId);
            CurrentTrackId = trackId;
            BeginPlaySession(trackId, durationSeconds);
            SyncAlbumTrackPlayingState();
            NowPlaying = nowPlayingText;
            ErrorMessage = string.Empty;
            PlayRequested?.Invoke(this, streamUri);
        }
        catch (Exception ex)
        {
            ErrorMessage = $"无法开始播放：{ex.Message}";
        }
    }

    public void NotifyPlaybackProgress(double playedSeconds, double? durationSeconds = null)
    {
        if (!CurrentTrackId.HasValue)
        {
            return;
        }

        var normalizedPlayedSeconds = (int)Math.Floor(Math.Max(playedSeconds, 0));
        var durationForRule = ResolveDurationForPlayReport(durationSeconds);
        if (!EffectivePlayReportRules.ShouldReport(normalizedPlayedSeconds, durationForRule, _effectivePlayReported))
        {
            return;
        }

        _effectivePlayReported = true;
        _ = RecordPlayBestEffortAsync(CurrentTrackId.Value, normalizedPlayedSeconds, durationForRule, _activePlaySessionKey);
    }

    private int? ResolveDurationForPlayReport(double? durationSeconds)
    {
        if (durationSeconds.HasValue && durationSeconds.Value > 0)
        {
            return (int)Math.Round(durationSeconds.Value, MidpointRounding.AwayFromZero);
        }

        if (_activeTrackDurationSeconds.HasValue && _activeTrackDurationSeconds.Value > 0)
        {
            return _activeTrackDurationSeconds.Value;
        }

        return null;
    }

    private void BeginPlaySession(int trackId, int? durationSeconds)
    {
        _activeTrackDurationSeconds = durationSeconds;
        _effectivePlayReported = false;
        _activePlaySessionKey = $"{trackId}-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}-{Guid.NewGuid():N}";
    }

    private void ResetPlaySession()
    {
        _effectivePlayReported = false;
        _activeTrackDurationSeconds = null;
    }

    private void PlayFromQueue(IReadOnlyList<PlaybackQueueItem> queue, int trackId)
    {
        if (queue.Count == 0)
        {
            return;
        }

        _playbackQueue.Clear();
        if (PreventDuplicateQueueItems)
        {
            _playbackQueue.AddRange(queue.GroupBy(item => item.Id).Select(group => group.First()));
        }
        else
        {
            _playbackQueue.AddRange(queue);
        }
        _playbackIndex = _playbackQueue.FindIndex(item => item.Id == trackId);
        if (_playbackIndex < 0)
        {
            _playbackIndex = 0;
        }

        PlayQueueItem(_playbackQueue[_playbackIndex]);
        SyncQueueProjection();
    }

    private void AppendToQueue(PlaybackQueueItem item)
    {
        if (PreventDuplicateQueueItems && _playbackQueue.Any(queueItem => queueItem.Id == item.Id))
        {
            return;
        }

        _playbackQueue.Add(item);
        SyncQueueProjection();

        if (QueueAutoPlayOnAdd && _playbackIndex < 0)
        {
            _playbackIndex = 0;
            PlayQueueItem(item);
        }
    }

    private void PlayQueueItem(PlaybackQueueItem item)
    {
        var display = string.IsNullOrWhiteSpace(item.ArtistsDisplay)
            ? $"播放中：{item.Title}"
            : $"播放中：{item.Title} - {item.ArtistsDisplay}";
        PlayTrackById(item.Id, display, item.DurationSeconds);
    }

    private async Task RecordPlayBestEffortAsync(int trackId, int playedSeconds, int? durationSeconds, string? sessionKey)
    {
        try
        {
            await _trackService.RecordPlayAsync(trackId, playedSeconds, durationSeconds, sessionKey ?? _sessionKey);
        }
        catch
        {
            // Playback should not fail because analytics endpoint is temporarily unavailable.
        }
    }

    private bool TryMoveToNext()
    {
        if (!PlaybackQueueRules.TryGetNextIndex(PlayMode, _playbackIndex, _playbackQueue.Count, _random, out var nextIndex))
        {
            return false;
        }

        _playbackIndex = nextIndex;
        return true;
    }

    private bool TryMoveToPrevious()
    {
        if (!PlaybackQueueRules.TryGetPreviousIndex(PlayMode, _playbackIndex, _playbackQueue.Count, _random, out var previousIndex))
        {
            return false;
        }

        _playbackIndex = previousIndex;
        return true;
    }

    private void SyncQueueProjection()
    {
        PlaybackQueue.Clear();
        foreach (var queueItem in _playbackQueue)
        {
            PlaybackQueue.Add(queueItem);
        }

        ApplyQueueFilters();
    }

    private void SyncAlbumTrackPlayingState()
    {
        foreach (var row in AlbumTrackRows)
        {
            row.IsCurrentPlaying = CurrentTrackId.HasValue && row.Id == CurrentTrackId.Value;
        }
    }

    [RelayCommand]
    private async Task PlaySelectedGameAllAsync()
    {
        if (SelectedGame is null)
        {
            ErrorMessage = "请先选择游戏。";
            return;
        }

        IsBusy = true;
        try
        {
            var tracks = await _trackService.GetPublicTracksAsync(limit: 100, gameIds: GetSelectedGameIds());
            if (tracks.Count == 0)
            {
                ErrorMessage = "当前游戏暂无可播放曲目。";
                return;
            }

            PlayFromQueue(
                tracks.Select(track => new PlaybackQueueItem(track.Id, track.Title, track.ArtistsDisplay, track.Duration)).ToList(),
                tracks[0].Id);
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "加载当前游戏曲目失败，请稍后重试。");
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private void PlayRandomTrack(PublicTrackItem? track)
    {
        PlayDiscoverTrack(track);
    }

    [RelayCommand]
    private void PlayTopTrack(PublicTrackItem? track)
    {
        var target = track;
        if (target is null)
        {
            ErrorMessage = "请先选择热门曲目。";
            return;
        }

        PlayFromQueue(
            TopTracks.Select(item => new PlaybackQueueItem(item.Id, item.Title, item.AlbumTitle ?? string.Empty, item.Duration)).ToList(),
            target.Id);
    }

    private void ApplyQueueFilters()
    {
        IEnumerable<PlaybackQueueItem> query = PlaybackQueue;
        if (!string.IsNullOrWhiteSpace(QueueFilterText))
        {
            var keyword = QueueFilterText.Trim();
            query = query.Where(item =>
                item.Title.Contains(keyword, StringComparison.OrdinalIgnoreCase) ||
                item.ArtistsDisplay.Contains(keyword, StringComparison.OrdinalIgnoreCase));
        }

        PlaybackQueueView.Clear();
        foreach (var item in query)
        {
            PlaybackQueueView.Add(item);
        }
    }

    private void MoveQueueItemByDelta(int trackId, int delta)
    {
        var sourceIndex = _playbackQueue.FindIndex(item => item.Id == trackId);
        if (sourceIndex < 0)
        {
            return;
        }

        var targetIndex = sourceIndex + delta;
        if (targetIndex < 0 || targetIndex >= _playbackQueue.Count)
        {
            return;
        }

        var item = _playbackQueue[sourceIndex];
        _playbackQueue.RemoveAt(sourceIndex);
        _playbackQueue.Insert(targetIndex, item);

        if (_playbackIndex == sourceIndex)
        {
            _playbackIndex = targetIndex;
        }
        else if (delta < 0 && _playbackIndex >= targetIndex && _playbackIndex < sourceIndex)
        {
            _playbackIndex++;
        }
        else if (delta > 0 && _playbackIndex <= targetIndex && _playbackIndex > sourceIndex)
        {
            _playbackIndex--;
        }

        SyncQueueProjection();
    }

}
