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
    private async Task InitializeAsync()
    {
        IsBusy = true;
        ErrorMessage = string.Empty;
        _isInitializing = true;

        try
        {
            LoadingStage = "恢复会话";
            var token = await _authService.GetSavedTokenAsync();
            IsAuthenticated = !string.IsNullOrWhiteSpace(token);
            if (IsAuthenticated)
            {
                LoadingStage = "加载账户数据";
                var user = await _authService.GetCurrentUserAsync();
                CurrentUserDisplay = user?.Username ?? "已登录";
                IsAdmin = user?.IsAdmin == true;
                await LoadTracksAsync();
                await LoadFavoritesAsync();
                await LoadPlaylistsAsync();
                await RefreshInboxAsync();
            }
            else
            {
                CurrentUserDisplay = "游客";
                IsAdmin = false;
            }

            LoadingStage = "加载游戏与发现";
            await LoadSiteConfigAsync();
            await LoadGamesAsync();
            await LoadSelectedGameAlbumsAsync();
            await LoadDiscoverAsync();
            await LoadPublicTracksAsync();
            RefreshDownloadTasks();
            LoadingStage = "完成";
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "初始化失败，请稍后重试。");
        }
        catch (Exception ex)
        {
            ErrorMessage = $"初始化失败：{ex.Message}";
        }
        finally
        {
            _isInitializing = false;
            IsBusy = false;
            if (LoadingStage != "完成")
            {
                LoadingStage = "空闲";
            }
        }
    }

    [RelayCommand]
    private async Task LoginAsync()
    {
        if (string.IsNullOrWhiteSpace(Identifier) || string.IsNullOrWhiteSpace(Password))
        {
            ErrorMessage = "请输入账号和密码。";
            return;
        }

        IsBusy = true;
        ErrorMessage = string.Empty;

        try
        {
            await _authService.LoginAsync(new LoginRequest
            {
                Identifier = Identifier.Trim(),
                Password = Password,
            });

            var user = await _authService.GetCurrentUserAsync();

            Password = string.Empty;
            IsAuthenticated = true;
            CurrentUserDisplay = user?.Username ?? Identifier;
            IsAdmin = user?.IsAdmin == true;
            await LoadTracksAsync();
            await LoadFavoritesAsync();
            await LoadPlaylistsAsync();
            await RefreshInboxAsync();
            await TryRestorePendingSectionAfterLoginAsync();
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "登录失败，请检查账号密码后重试。");
        }
        catch (Exception ex)
        {
            ErrorMessage = $"登录失败：{ex.Message}";
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task SendVerificationCodeAsync()
    {
        if (string.IsNullOrWhiteSpace(RegisterEmail))
        {
            ErrorMessage = "请输入注册邮箱。";
            return;
        }

        IsBusy = true;
        ErrorMessage = string.Empty;
        try
        {
            VerificationChallengeId = await _authService.SendRegistrationVerificationCodeAsync(new SendVerificationCodeRequest
            {
                Email = RegisterEmail.Trim(),
            }) ?? string.Empty;

            ErrorMessage = string.IsNullOrWhiteSpace(VerificationChallengeId)
                ? "验证码请求已提交，请检查邮箱。"
                : "验证码已发送，请在 10 分钟内完成注册。";
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "发送验证码失败，请稍后重试。");
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task RegisterAsync()
    {
        if (string.IsNullOrWhiteSpace(RegisterUsername) || string.IsNullOrWhiteSpace(RegisterEmail))
        {
            ErrorMessage = "请输入用户名和邮箱。";
            return;
        }

        if (string.IsNullOrWhiteSpace(RegisterPassword) || RegisterPassword.Length < 6)
        {
            ErrorMessage = "注册密码至少 6 位。";
            return;
        }

        if (string.IsNullOrWhiteSpace(VerificationChallengeId) || string.IsNullOrWhiteSpace(VerificationCode))
        {
            ErrorMessage = "请先获取并填写邮箱验证码。";
            return;
        }

        IsBusy = true;
        ErrorMessage = string.Empty;
        try
        {
            var session = await _authService.RegisterAsync(new RegisterRequest
            {
                Username = RegisterUsername.Trim(),
                Email = RegisterEmail.Trim(),
                VerificationChallengeId = VerificationChallengeId.Trim(),
                VerificationCode = VerificationCode.Trim(),
                Password = RegisterPassword,
                ConfirmPassword = RegisterConfirmPassword,
            });

            RegisterUsername = string.Empty;
            RegisterEmail = string.Empty;
            RegisterPassword = string.Empty;
            RegisterConfirmPassword = string.Empty;
            VerificationCode = string.Empty;
            VerificationChallengeId = string.Empty;

            IsAuthenticated = true;
            CurrentUserDisplay = session.User?.Username ?? "已登录";
            IsAdmin = session.User?.IsAdmin == true;
            await LoadTracksAsync();
            await LoadFavoritesAsync();
            await LoadPlaylistsAsync();
            await RefreshInboxAsync();
            await TryRestorePendingSectionAfterLoginAsync();
            ErrorMessage = "注册成功，已自动登录。";
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "注册失败，请检查信息后重试。");
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private void OpenSection(string? section)
    {
        var requestedSection = section switch
        {
            SectionDiscover => SectionDiscover,
            SectionAlbumDetail => SectionAlbumDetail,
            SectionGames => SectionGames,
            SectionAlbums => SectionAlbums,
            SectionArtists => SectionArtists,
            SectionTags => SectionTags,
            SectionSearch => SectionSearch,
            SectionLibrary => SectionLibrary,
            SectionFavorites => SectionFavorites,
            SectionPlaylists => SectionPlaylists,
            SectionProfile => SectionProfile,
            SectionSettings => SectionSettings,
            SectionDownloads => SectionDownloads,
            SectionAdmin => SectionAdmin,
            _ => SectionDiscover,
        };

        if (!IsAuthenticated && IsRestrictedSection(requestedSection))
        {
            RememberPendingSection(requestedSection);
            ErrorMessage = "请先登录后再访问收藏和歌单。";
            requestedSection = SectionLibrary;
        }

        if (requestedSection == SectionAdmin && !IsAdmin)
        {
            RememberPendingSection(SectionAdmin);
            ErrorMessage = "仅管理员可访问管理页面。";
            requestedSection = SectionDiscover;
        }

        SelectedSection = requestedSection;
        SelectedSectionIndex = SectionToIndex(SelectedSection);

        if (requestedSection == SectionAdmin && IsAdmin)
        {
            _ = EnsureAdminSectionDataAsync(forceReload: false);
        }
    }

    private static bool IsRestrictedSection(string section)
    {
        return section is SectionFavorites or SectionPlaylists or SectionProfile or SectionDownloads;
    }

    private static int SectionToIndex(string section)
    {
        return section switch
        {
            SectionDiscover => 0,
            SectionAlbumDetail => 0,
            SectionGames => 1,
            SectionAlbums => 2,
            SectionArtists => 3,
            SectionTags => 4,
            SectionSearch => 5,
            SectionLibrary => 6,
            SectionFavorites => 7,
            SectionPlaylists => 8,
            SectionProfile => 9,
            SectionSettings => 10,
            SectionDownloads => 11,
            SectionAdmin => 12,
            _ => 0,
        };
    }

    [RelayCommand]
    private void AcknowledgeFirstVisit()
    {
        if (!FirstVisitAcknowledgeEnabled)
        {
            return;
        }

        var ackKey = $"first_visit_ack_{_activeFirstVisitVersion}";
        TrySetLocalSetting(ackKey, true);
        ShowFirstVisitModal = false;
        FirstVisitAcknowledgeEnabled = false;
        _firstVisitCountdownCts?.Cancel();
    }

    [RelayCommand]
    private async Task OpenComplianceLinkAsync(string? url)
    {
        if (string.IsNullOrWhiteSpace(url))
        {
            return;
        }

        try
        {
            await Launcher.LaunchUriAsync(new Uri(url));
        }
        catch (Exception ex)
        {
            ErrorMessage = $"打开链接失败：{ex.Message}";
        }
    }

    [RelayCommand]
    private async Task SubmitFeedbackAsync()
    {
        if (string.IsNullOrWhiteSpace(FeedbackContent))
        {
            ErrorMessage = "请输入反馈内容。";
            return;
        }

        IsBusy = true;
        try
        {
            await _feedbackService.SubmitAsync(FeedbackContent.Trim(), string.IsNullOrWhiteSpace(FeedbackContact) ? null : FeedbackContact.Trim());
            FeedbackContent = string.Empty;
            FeedbackContact = string.Empty;
            SuccessMessage = "反馈已提交，感谢你的建议。";
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "提交反馈失败，请稍后重试。");
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task BatchUnfavoriteFilteredAsync()
    {
        if (!IsAuthenticated)
        {
            ErrorMessage = "请先登录。";
            return;
        }

        var targets = FavoriteTracksView.ToList();
        if (targets.Count == 0)
        {
            ErrorMessage = "当前筛选没有收藏曲目。";
            return;
        }

        IsBusy = true;
        foreach (var track in targets)
        {
            try
            {
                await _favoriteService.ToggleAsync(track.Id);
            }
            catch
            {
                // Keep best-effort batch behavior.
            }
        }

        await LoadFavoritesAsync();
        IsBusy = false;
        SuccessMessage = "已批量取消当前筛选收藏。";
    }

    [RelayCommand]
    private void DismissSuccess()
    {
        SuccessMessage = string.Empty;
        ShowSuccessMessage = false;
    }

    [RelayCommand]
    private void SetThemeMode(string? mode)
    {
        ThemeMode = string.Equals(mode, "dark", StringComparison.OrdinalIgnoreCase)
            ? "dark"
            : string.Equals(mode, "light", StringComparison.OrdinalIgnoreCase)
                ? "light"
                : "system";
    }

    [RelayCommand]
    private async Task MarkAllMessagesReadAsync()
    {
        if (!IsAuthenticated)
        {
            ErrorMessage = "请先登录后查看消息。";
            return;
        }

        IsInboxLoading = true;
        try
        {
            await _messageService.MarkAllMessagesReadAsync();
            await LoadInboxMessagesAsync(Math.Max(InboxPage, 1));
            await LoadUnreadMessageCountAsync();
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "标记全部已读失败，请稍后重试。");
        }
        finally
        {
            IsInboxLoading = false;
        }
    }

    [RelayCommand]
    private async Task MarkMessageReadAsync(InboxMessageItem? message)
    {
        if (!IsAuthenticated || message is null)
        {
            return;
        }

        try
        {
            await _messageService.MarkMessageReadAsync(message.Id);
            await LoadInboxMessagesAsync(Math.Max(InboxPage, 1));
            await LoadUnreadMessageCountAsync();
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "消息已读状态更新失败，请稍后重试。");
        }
    }

    [RelayCommand]
    private void ToggleLyricsPreviewExpanded()
    {
        LyricsPreviewExpanded = !LyricsPreviewExpanded;
    }

    [RelayCommand]
    private void IncreaseLyricsFontSize()
    {
        LyricsFontSize = Math.Min(26, LyricsFontSize + 1);
    }

    [RelayCommand]
    private void DecreaseLyricsFontSize()
    {
        LyricsFontSize = Math.Max(10, LyricsFontSize - 1);
    }

    [RelayCommand]
    private void CopyDetailLyricsText()
    {
        if (string.IsNullOrWhiteSpace(DetailLyrics))
        {
            ErrorMessage = "暂无歌词可复制。";
            return;
        }

        var package = new Windows.ApplicationModel.DataTransfer.DataPackage();
        package.SetText(DetailLyrics);
        Windows.ApplicationModel.DataTransfer.Clipboard.SetContent(package);
        SuccessMessage = "歌词已复制。";
    }

    [RelayCommand]
    private void CopyDetailCreditsText()
    {
        if (DetailCredits.Count == 0)
        {
            ErrorMessage = "暂无制作人员信息可复制。";
            return;
        }

        var content = string.Join(Environment.NewLine, DetailCredits.Select(item => item.DisplayText));
        var package = new Windows.ApplicationModel.DataTransfer.DataPackage();
        package.SetText(content);
        Windows.ApplicationModel.DataTransfer.Clipboard.SetContent(package);
        SuccessMessage = "制作人员信息已复制。";
    }

    [RelayCommand]
    private void CopyDetailSourcesText()
    {
        if (DetailMusicSources.Count == 0)
        {
            ErrorMessage = "暂无音乐来源信息可复制。";
            return;
        }

        var content = string.Join(Environment.NewLine, DetailMusicSources.Select(item => item.DisplayText));
        var package = new Windows.ApplicationModel.DataTransfer.DataPackage();
        package.SetText(content);
        Windows.ApplicationModel.DataTransfer.Clipboard.SetContent(package);
        SuccessMessage = "音乐来源信息已复制。";
    }

    [RelayCommand]
    private void CopyDetailShareText()
    {
        if (CurrentDetailTrack is null)
        {
            ErrorMessage = "请先加载曲目详情。";
            return;
        }

        var shareText = $"{CurrentDetailTrack.Title} - {CurrentDetailTrack.ArtistsDisplay} | {CurrentDetailTrack.AlbumTitle} | {CurrentDetailTrack.DurationDisplay}";
        var package = new Windows.ApplicationModel.DataTransfer.DataPackage();
        package.SetText(shareText);
        Windows.ApplicationModel.DataTransfer.Clipboard.SetContent(package);
        SuccessMessage = "分享文案已复制。";
    }

    [RelayCommand]
    private async Task LogoutAsync()
    {
        await ApplyLoggedOutStateAsync();
    }

    [RelayCommand]
    private async Task ChangePasswordAsync()
    {
        if (!IsAuthenticated)
        {
            ErrorMessage = "需要先登录。";
            return;
        }

        if (string.IsNullOrWhiteSpace(CurrentPassword) || string.IsNullOrWhiteSpace(NewPassword))
        {
            ErrorMessage = "请输入当前密码和新密码。";
            return;
        }

        IsBusy = true;
        try
        {
            await _authService.ChangePasswordAsync(new ChangePasswordRequest
            {
                CurrentPassword = CurrentPassword,
                NewPassword = NewPassword,
            });
            CurrentPassword = string.Empty;
            NewPassword = string.Empty;
            ErrorMessage = "密码修改成功。";
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "修改密码失败，请稍后重试。");
        }
        finally
        {
            IsBusy = false;
        }
    }

    private void RememberPendingSection(string section)
    {
        if (string.IsNullOrWhiteSpace(section))
        {
            return;
        }

        if (section == SectionAdmin || IsRestrictedSection(section))
        {
            _pendingSectionAfterLogin = section;
        }
    }

    private async Task TryRestorePendingSectionAfterLoginAsync()
    {
        var pending = _pendingSectionAfterLogin;
        _pendingSectionAfterLogin = null;
        if (string.IsNullOrWhiteSpace(pending))
        {
            return;
        }

        if (pending == SectionAdmin && !IsAdmin)
        {
            return;
        }

        if (IsRestrictedSection(pending) && !IsAuthenticated)
        {
            return;
        }

        OpenSection(pending);
        if (pending == SectionAdmin && IsAdmin)
        {
            await EnsureAdminSectionDataAsync(forceReload: false);
        }
    }

    private async Task LoadSiteConfigAsync()
    {
        try
        {
            var maintenanceTask = _siteConfigService.GetPublicMaintenanceModeAsync();
            var firstVisitTask = _siteConfigService.GetPublicFirstVisitModalAsync();
            var complianceTask = _siteConfigService.GetPublicComplianceConfigAsync();

            var maintenance = await maintenanceTask;
            IsMaintenanceMode = maintenance.Enabled;
            MaintenanceMessage = string.IsNullOrWhiteSpace(maintenance.Message) ? "站点维护中，请稍后再试。" : maintenance.Message.Trim();
            MaintenanceExpectedEndTimeText = string.IsNullOrWhiteSpace(maintenance.ExpectedEndTime)
                ? ""
                : $"预计恢复时间：{maintenance.ExpectedEndTime}";

            var firstVisit = await firstVisitTask;
            _activeFirstVisitVersion = string.IsNullOrWhiteSpace(firstVisit.Version) ? "1" : firstVisit.Version.Trim();
            FirstVisitTitle = string.IsNullOrWhiteSpace(firstVisit.Title) ? "欢迎来到 HoYoMusic" : firstVisit.Title.Trim();
            FirstVisitContent = string.IsNullOrWhiteSpace(firstVisit.Content) ? "请先阅读并确认使用须知。" : firstVisit.Content.Trim();

            var ackKey = $"first_visit_ack_{_activeFirstVisitVersion}";
            var hasAck = TryGetLocalSettingBool(ackKey);

            if (firstVisit.Enabled && !hasAck)
            {
                var minStaySeconds = Math.Clamp(firstVisit.MinStaySeconds, 0, 60);
                ShowFirstVisitModal = true;
                FirstVisitAcknowledgeEnabled = minStaySeconds == 0;
                FirstVisitCountdownSeconds = minStaySeconds;
                _ = RunFirstVisitCountdownAsync(minStaySeconds);
            }
            else
            {
                ShowFirstVisitModal = false;
                FirstVisitAcknowledgeEnabled = false;
                FirstVisitCountdownSeconds = 0;
            }

            var compliance = await complianceTask;
            ShowComplianceFooter = compliance.Enabled;
            ComplianceIcpNumber = compliance.IcpNumber;
            CompliancePublicSecurityNumber = compliance.PublicSecurityNumber;
        }
        catch
        {
            // Site config is best-effort; keep app usable when this public endpoint is unavailable.
            ShowComplianceFooter = false;
            IsMaintenanceMode = false;
            ShowFirstVisitModal = false;
            FirstVisitAcknowledgeEnabled = false;
            FirstVisitCountdownSeconds = 0;
        }
    }

    private async Task RunFirstVisitCountdownAsync(int seconds)
    {
        _firstVisitCountdownCts?.Cancel();
        _firstVisitCountdownCts?.Dispose();
        _firstVisitCountdownCts = new CancellationTokenSource();
        var token = _firstVisitCountdownCts.Token;

        for (var remaining = seconds; remaining > 0; remaining--)
        {
            FirstVisitCountdownSeconds = remaining;
            try
            {
                await Task.Delay(TimeSpan.FromSeconds(1), token);
            }
            catch (TaskCanceledException)
            {
                return;
            }
        }

        FirstVisitCountdownSeconds = 0;
        FirstVisitAcknowledgeEnabled = true;
    }

    private async Task LoadUnreadMessageCountAsync()
    {
        if (!IsAuthenticated)
        {
            UnreadMessageCount = 0;
            return;
        }

        try
        {
            UnreadMessageCount = await _messageService.GetUnreadCountAsync();
        }
        catch (ApiException ex)
        {
            await HandleApiExceptionAsync(ex, "加载未读消息数失败，请稍后重试。");
        }
    }

    private async Task ApplyLoggedOutStateAsync(bool clearError = true)
    {
        if (SelectedSection == SectionAdmin || IsRestrictedSection(SelectedSection))
        {
            RememberPendingSection(SelectedSection);
        }

        await _authService.LogoutAsync();
        Tracks.Clear();
        FavoriteTracks.Clear();
        Playlists.Clear();
        PlaylistTracks.Clear();
        InboxMessages.Clear();
        UnreadMessageCount = 0;
        IsAuthenticated = false;
        SelectedTrack = null;
        SelectedFavoriteTrack = null;
        SelectedPlaylist = null;
        SelectedPlaylistTrack = null;
        CurrentPassword = string.Empty;
        NewPassword = string.Empty;
        CurrentUserDisplay = "游客";
        IsAdmin = false;
        NowPlaying = "暂无播放";
        CurrentTrackId = null;
        CurrentDetailTrack = null;
        DetailLyrics = string.Empty;
        DetailLyricsStatus = string.Empty;
        DetailCredits.Clear();
        DetailMusicSources.Clear();
        AdminUsers.Clear();
        AdminTags.Clear();
        AdminTagGroups.Clear();
        AdminFeedbackItems.Clear();
        AdminDiscs.Clear();
        AdminLyricsPreviewItems.Clear();
        AdminLyricsCommitItems.Clear();
        ShowInboxStatus = false;
        InboxStatusMessage = string.Empty;
        ShowTrackDetailStatus = false;
        TrackDetailStatusMessage = string.Empty;
        SuccessMessage = string.Empty;
        ShowSuccessMessage = false;
        SyncAlbumTrackPlayingState();
        ClearQueue();
        if (SelectedSection == SectionAdmin)
        {
            SelectedSection = SectionDiscover;
            SelectedSectionIndex = 0;
        }
        if (clearError)
        {
            ErrorMessage = string.Empty;
        }
    }

    private static bool TryGetLocalSettingBool(string key)
    {
        try
        {
            return ApplicationData.Current.LocalSettings.Values.TryGetValue(key, out var value)
                && value is bool parsed
                && parsed;
        }
        catch
        {
            return false;
        }
    }

    private static void TrySetLocalSetting(string key, object value)
    {
        try
        {
            ApplicationData.Current.LocalSettings.Values[key] = value;
        }
        catch
        {
            // Ignore settings persistence errors when running unpackaged.
        }
    }

    private static int? ParsePositiveIntOrNull(string? raw)
    {
        if (!int.TryParse(raw, out var parsed) || parsed <= 0)
        {
            return null;
        }

        return parsed;
    }

    private static int? ParseIntOrNull(string? raw)
    {
        if (!int.TryParse(raw, out var parsed))
        {
            return null;
        }

        return parsed;
    }

}
