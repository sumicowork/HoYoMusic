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
    private async Task ApplyArtistFacetAsync(FacetItem? facet)
    {
        if (facet is null)
        {
            return;
        }

        SearchArtist = facet.Value;
        OpenSection(SectionLibrary);
        LibraryPage = 1;
        await LoadPublicTracksAsync(1);
    }

    [RelayCommand]
    private async Task ApplyTagFacetAsync(FacetItem? facet)
    {
        if (facet is null)
        {
            return;
        }

        if (facet.Value.StartsWith("duration:", StringComparison.OrdinalIgnoreCase))
        {
            DurationBucket = facet.Value["duration:".Length..];
        }
        else if (facet.Value.StartsWith("lyrics:", StringComparison.OrdinalIgnoreCase))
        {
            LyricsStatus = facet.Value["lyrics:".Length..];
        }

        OpenSection(SectionLibrary);
        LibraryPage = 1;
        await LoadPublicTracksAsync(1);
    }

    [RelayCommand]
    private async Task ApplyRecentSearchKeywordAsync(string? keyword)
    {
        if (string.IsNullOrWhiteSpace(keyword))
        {
            return;
        }

        SearchKeyword = keyword;
        await OpenSearchCenterAsync();
    }

    [RelayCommand]
    private void ClearRecentSearchKeywords()
    {
        RecentSearchKeywords.Clear();
    }

    [RelayCommand]
    private async Task RefreshGamesAsync()
    {
        await LoadGamesAsync();
    }

    [RelayCommand]
    private async Task OpenAlbumDetailAsync(GameAlbumItem? album)
    {
        var target = album ?? SelectedGameAlbum;
        if (target is null)
        {
            return;
        }

        SelectedGameAlbum = target;
        await LoadSelectedAlbumAsync(target.Id);
        OpenSection(SectionAlbumDetail);
    }

    [RelayCommand]
    private async Task OpenAlbumTrackDetailAsync(AlbumTrackRow? row)
    {
        var target = row ?? SelectedAlbumTrackRow;
        if (target is null)
        {
            return;
        }

        await LoadTrackDetailAsync(target.Id);
    }

    private void PushRecentSearchKeyword(string keyword)
    {
        for (var i = RecentSearchKeywords.Count - 1; i >= 0; i--)
        {
            if (string.Equals(RecentSearchKeywords[i], keyword, StringComparison.OrdinalIgnoreCase))
            {
                RecentSearchKeywords.RemoveAt(i);
            }
        }

        RecentSearchKeywords.Insert(0, keyword);
        while (RecentSearchKeywords.Count > 8)
        {
            RecentSearchKeywords.RemoveAt(RecentSearchKeywords.Count - 1);
        }
    }

    private void RefreshFacetCollections()
    {
        var sourceTracks = PublicTracks
            .Concat(FavoriteTracks)
            .Concat(PlaylistTracks)
            .GroupBy(item => item.Id)
            .Select(group => group.First())
            .ToList();

        ArtistFacetItems.Clear();
        foreach (var facet in sourceTracks
                     .SelectMany(item => item.Artists)
                     .GroupBy(item => item.Name, StringComparer.OrdinalIgnoreCase)
                     .OrderByDescending(group => group.Count())
                     .ThenBy(group => group.Key)
                     .Take(20)
                     .Select(group => new FacetItem(group.Key, group.Key, group.Count())))
        {
            ArtistFacetItems.Add(facet);
        }

        var durationFacets = sourceTracks
            .Where(item => item.Duration is not null)
            .GroupBy(item => item.Duration switch
            {
                <= 120 => "short",
                <= 300 => "medium",
                _ => "long",
            })
            .Select(group => new FacetItem($"时长 {group.Key}", $"duration:{group.Key}", group.Count()));

        TagFacetItems.Clear();
        foreach (var facet in durationFacets.OrderByDescending(item => item.Count))
        {
            TagFacetItems.Add(facet);
        }

    }

    private async Task LoadGamesAsync()
    {
        try
        {
            var games = await _gameService.GetGamesAsync();
            Games.Clear();
            foreach (var game in games)
            {
                Games.Add(game);
            }

            if (Games.Count == 0)
            {
                SelectedGame = null;
                ErrorMessage = "加载游戏失败：服务器返回空列表。";
                return;
            }

            var currentId = SelectedGame?.Id;
            SelectedGame = currentId is not null
                ? Games.FirstOrDefault(item => item.Id == currentId.Value) ?? Games.First()
                : Games.First();
            OnPropertyChanged(nameof(SelectedGameSummary));
        }
        catch (ApiException ex)
        {
            Games.Clear();
            SelectedGame = null;
            await HandleApiExceptionAsync(ex, "加载游戏失败，请稍后重试。");
        }
        catch (Exception ex)
        {
            Games.Clear();
            SelectedGame = null;
            ErrorMessage = $"加载游戏失败：{ex.Message}";
        }
    }

    private async Task ApplySelectedGameAsync()
    {
        IsBusy = true;
        try
        {
            await LoadSelectedGameAlbumsAsync();
            await LoadDiscoverAsync();
            await LoadPublicTracksAsync(search: SearchKeyword);
            if (IsAuthenticated)
            {
                await LoadTracksAsync();
            }
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task LoadSelectedGameAlbumsAsync()
    {
        if (SelectedGame is null)
        {
            SelectedGameAlbums.Clear();
            return;
        }

        try
        {
            var albums = await _gameService.GetGameAlbumsAsync(SelectedGame.Id);
            SelectedGameAlbums.Clear();
            foreach (var album in albums)
            {
                SelectedGameAlbums.Add(album);
            }

            if (SelectedGameAlbums.Count > 0)
            {
                var nextAlbum = SelectedGameAlbum is null
                    ? SelectedGameAlbums[0]
                    : SelectedGameAlbums.FirstOrDefault(item => item.Id == SelectedGameAlbum.Id) ?? SelectedGameAlbums[0];
                SelectedGameAlbum = nextAlbum;
            }
            else
            {
                SelectedGameAlbum = null;
            }

            OnPropertyChanged(nameof(SelectedGameSummary));
            OnPropertyChanged(nameof(DiscoverSummary));
        }
        catch (ApiException ex)
        {
            SelectedGameAlbums.Clear();
            SelectedGameAlbum = null;
            await HandleApiExceptionAsync(ex, "加载游戏专辑失败，请稍后重试。");
        }
    }

    private async Task LoadSelectedAlbumAsync(int albumId)
    {
        IsAlbumLoading = true;
        ShowAlbumStatus = true;
        AlbumStatusMessage = "正在加载专辑详情...";
        try
        {
            var detail = await _albumService.GetAlbumByIdAsync(albumId);
            CurrentAlbum = detail.Album;
            AlbumTracks.Clear();
            AlbumTrackRows.Clear();
            foreach (var track in detail.Tracks)
            {
                AlbumTracks.Add(track);
                AlbumTrackRows.Add(new AlbumTrackRow
                {
                    Id = track.Id,
                    Title = track.Title,
                    ArtistsDisplay = track.ArtistsDisplay,
                    DurationSeconds = track.Duration,
                    IsCurrentPlaying = CurrentTrackId == track.Id,
                });
            }

            SelectedAlbumTrack = AlbumTracks.FirstOrDefault();
            SelectedAlbumTrackRow = AlbumTrackRows.FirstOrDefault();
            if (AlbumTrackRows.Count == 0)
            {
                ShowAlbumStatus = true;
                AlbumStatusMessage = "该专辑暂无曲目。";
            }
            else
            {
                ShowAlbumStatus = false;
                AlbumStatusMessage = string.Empty;
            }
        }
        catch (ApiException ex)
        {
            CurrentAlbum = null;
            AlbumTracks.Clear();
            AlbumTrackRows.Clear();
            ShowAlbumStatus = true;
            AlbumStatusMessage = HoYoMusic.Desktop.Core.Contracts.ApiErrorMapper.Resolve(ex, "加载专辑详情失败，请稍后重试。");
            await HandleApiExceptionAsync(ex, "加载专辑详情失败，请稍后重试。");
        }
        finally
        {
            IsAlbumLoading = false;
        }
    }

    [RelayCommand]
    private async Task QuickPlayAlbumAsync(GameAlbumItem? album)
    {
        var target = album ?? SelectedGameAlbum;
        if (target is null)
        {
            ErrorMessage = "请先选择专辑。";
            return;
        }

        SelectedGameAlbum = target;
        await LoadSelectedAlbumAsync(target.Id);
        if (AlbumTracks.Count == 0)
        {
            ErrorMessage = "该专辑暂无可播放曲目。";
            return;
        }

        OpenSection(SectionAlbumDetail);
        PlayAlbumAll();
    }

    [RelayCommand]
    private async Task AddAlbumTrackToPlaylistAsync(AlbumTrackRow? row)
    {
        var targetRow = row ?? SelectedAlbumTrackRow;
        if (targetRow is null)
        {
            ErrorMessage = "请先选择专辑曲目。";
            return;
        }

        var targetTrack = AlbumTracks.FirstOrDefault(item => item.Id == targetRow.Id);
        if (targetTrack is null)
        {
            ErrorMessage = "未找到对应曲目。";
            return;
        }

        await AddTrackToSelectedPlaylistAsync(targetTrack);
    }

}
